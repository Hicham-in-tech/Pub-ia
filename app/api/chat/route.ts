import { NextRequest, NextResponse } from "next/server";
import { getAudioIdByText, putAudio } from "@/lib/audioCache";
import { appendSessionTurn, getSessionTurns } from "@/lib/chatMemory";
import { getBestFaqHit, proposeFollowUpQuestions, searchFaqs } from "@/lib/fptFaqs";
import { transcribeAudio } from "@/lib/groq";
import { askMistral } from "@/lib/mistral";
import { synthesize } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK = process.env.N8N_WEBHOOK_URL;
const BACKEND_MODE = (process.env.CHAT_BACKEND_MODE ?? "local").toLowerCase();
const HAS_GROQ = Boolean(process.env.GROQ_API_KEY);
const IS_DEV = process.env.NODE_ENV !== "production";

type ChatPayload = { sessionId?: string; chatInput?: string; text?: string };

type Reply = {
  output: string;
  audioUrl: string | null;
  sessionId: string;
  suggestions: string[];
};
type ParsedInput = { sessionId: string; chatInput: string; source: "text" | "audio" };
type ParseResult =
  | { ok: true; value: ParsedInput }
  | { ok: false; response: NextResponse };

type LegacyN8nJson = {
  output?: string;
  text?: string;
  message?: string;
  sessionId?: string;
};

function clipForTts(text: string, maxChars: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxChars) return compact;

  const sliced = compact.slice(0, maxChars);
  const sentenceCut = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
    sliced.lastIndexOf("؛ "),
    sliced.lastIndexOf("; "),
  );

  if (sentenceCut >= Math.floor(maxChars * 0.45)) {
    return sliced.slice(0, sentenceCut + 1).trim();
  }

  return `${sliced.slice(0, Math.max(12, maxChars - 1)).trim()}…`;
}

function prepareTtsText(output: string): string {
  const configured = Number(process.env.ELEVENLABS_MAX_CHARS ?? "180");
  const maxChars = Number.isFinite(configured)
    ? Math.min(260, Math.max(24, Math.floor(configured)))
    : 180;
  return clipForTts(output, maxChars);
}

function quotaRetryLength(detail: string, currentLength: number): number | null {
  const m = detail.match(/have\s+(\d+)\s+credits\s+remaining[^\d]+(\d+)\s+credits\s+are\s+required/i);
  if (!m) return null;

  const remaining = Number(m[1]);
  const required = Number(m[2]);
  if (!Number.isFinite(remaining) || !Number.isFinite(required) || remaining <= 0 || required <= 0) {
    return null;
  }

  if (remaining >= required) return null;

  const ratio = remaining / required;
  const suggested = Math.floor(currentLength * ratio) - 1;
  return Math.max(20, Math.min(currentLength - 1, suggested));
}

function ttsCacheKey(text: string): string {
  const normalizedText = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "iP95p4xoKVk53GoZ742B";
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5";
  return `${voiceId}|${modelId}|${normalizedText}`;
}

async function synthesizeToAudioUrl(output: string): Promise<string | null> {
  if (!output.trim()) return null;

  let ttsText = prepareTtsText(output);
  let key = ttsCacheKey(ttsText);

  const cachedId = getAudioIdByText(key);
  if (cachedId) {
    console.info("[/api/chat] tts cache hit:", `id=${cachedId}`, `outputLen=${output.length}`, `ttsLen=${ttsText.length}`);
    return `/api/audio/${cachedId}`;
  }

  try {
    let tts = await synthesize(ttsText);

    if (
      !tts.ok &&
      tts.reason === "upstream" &&
      /quota_exceeded/i.test(tts.detail) &&
      ttsText.length > 20
    ) {
      const retryLen = quotaRetryLength(tts.detail, ttsText.length);
      if (retryLen && retryLen < ttsText.length) {
        const reduced = clipForTts(ttsText, retryLen);
        const reducedKey = ttsCacheKey(reduced);
        const reducedCachedId = getAudioIdByText(reducedKey);
        if (reducedCachedId) {
          console.info("[/api/chat] tts reduced cache hit:", `id=${reducedCachedId}`, `ttsLen=${reduced.length}`);
          return `/api/audio/${reducedCachedId}`;
        }

        console.warn("[/api/chat] tts quota retry:", `from=${ttsText.length}`, `to=${reduced.length}`);
        ttsText = reduced;
        key = reducedKey;
        tts = await synthesize(ttsText);
      }
    }

    if (tts.ok) {
      const id = putAudio(tts.bytes, tts.mimeType, key);
      console.info(
        "[/api/chat] tts cached:",
        `id=${id}`,
        `bytes=${tts.bytes.byteLength}`,
        `outputLen=${output.length}`,
        `ttsLen=${ttsText.length}`,
      );
      return `/api/audio/${id}`;
    }

    if (tts.reason === "upstream") {
      console.error("[/api/chat] elevenlabs upstream error:", tts.status, tts.detail.slice(0, 200));
    } else if (tts.reason === "network") {
      console.error("[/api/chat] elevenlabs network error:", tts.detail);
    } else {
      console.warn("[/api/chat] tts skipped:", tts.reason);
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/chat] tts threw unexpectedly:", msg);
    return null;
  }
}

function upstreamDebug(status: number, text: string): Record<string, unknown> {
  if (IS_DEV) return { upstreamStatus: status, upstreamBody: text.slice(0, 4000) };
  return { upstreamStatus: status };
}

async function forwardToN8n(req: NextRequest): Promise<Response> {
  if (!WEBHOOK) throw new Error("N8N_WEBHOOK_URL not configured");
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    if (!form.has("sessionId")) form.set("sessionId", "anon");
    if (!form.has("chatInput")) form.set("chatInput", "");
    return fetch(WEBHOOK, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  }

  const body = await req.json().catch(() => ({}));
  return fetch(WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
}

async function postWithLegacyN8n(req: NextRequest): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await forwardToN8n(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[/api/chat] n8n unreachable:", msg);
    return NextResponse.json(
      { error: "upstream_unreachable", detail: IS_DEV ? msg : undefined },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    console.error(
      `[/api/chat] n8n ${upstream.status} from ${WEBHOOK}:\n${text.slice(0, 2000)}`,
    );
    return NextResponse.json(
      { error: "upstream_error", ...upstreamDebug(upstream.status, text) },
      { status: 502 },
    );
  }

  let responseText: string;
  try {
    responseText = await upstream.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "read failed";
    console.error("[/api/chat] failed to read n8n body:", msg);
    return NextResponse.json(
      { error: "upstream_read_failed", detail: IS_DEV ? msg : undefined },
      { status: 502 },
    );
  }

  let raw: LegacyN8nJson | LegacyN8nJson[];
  try {
    raw = JSON.parse(responseText) as LegacyN8nJson | LegacyN8nJson[];
  } catch {
    console.error("[/api/chat] non-JSON n8n body:", responseText.slice(0, 500));
    return NextResponse.json(
      { error: "bad_json_from_upstream", ...upstreamDebug(upstream.status, responseText) },
      { status: 502 },
    );
  }

  const body: LegacyN8nJson = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  const output = body.output ?? body.text ?? body.message ?? "";
  const sessionId = body.sessionId ?? "anon";
  const suggestions = proposeFollowUpQuestions("", [], 6);

  const audioUrl = await synthesizeToAudioUrl(output);

  return NextResponse.json({ output, audioUrl, sessionId, suggestions } satisfies Reply);
}

function detectInputLang(text: string): "fr" | "ar" | "en" {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[a-z]/i.test(text) && /\b(what|how|where|when|which|tuition|degree|master|license)\b/i.test(text)) {
    return "en";
  }
  return "fr";
}

function fallbackReply(chatInput: string, bestAnswer: string | null): string {
  if (bestAnswer) return bestAnswer;

  const lang = detectInputLang(chatInput);
  if (lang === "ar") {
    return "يمكنني مساعدتك بسرعة في التكوينات، التسجيل، الجداول، الامتحانات وروابط الخدمات الطلابية الخاصة بـ FPT. إذا أردت معلومة دقيقة جدا، راجع الموقع الرسمي https://fpt.ac.ma أو اتصل بالرقم +212 05 28 55 10 10.";
  }

  if (lang === "en") {
    return "I can guide you on FPT programs, admissions, timetables, exams, and official student links. For a very specific update, please check https://fpt.ac.ma or call +212 05 28 55 10 10.";
  }

  return "Je peux vous orienter sur les formations, l'inscription, les emplois du temps, les examens et les liens officiels de la FPT. Pour une information très spécifique ou une mise à jour instantanée, consultez https://fpt.ac.ma ou appelez le standard au +212 05 28 55 10 10.";
}

function sanitizeDeadEndAnswer(output: string, chatInput: string, bestAnswer: string | null): string {
  const normalized = output.toLowerCase();
  const deadEndRe =
    /(je\s+n('| )?ai\s+pas|je\s+ne\s+sais\s+pas|je\s+ne\s+dispose\s+pas|aucune\s+information|pas\s+d'information|i\s+do\s+not\s+know|i\s+don't\s+know|cannot\s+find|can\s*'\s*t\s+find|not\s+enough\s+information|ما\s*عرفتش|لا\s+اعرف|لا\s+أعرف)/i;

  if (deadEndRe.test(normalized)) {
    return fallbackReply(chatInput, bestAnswer);
  }

  return output;
}

function makeDetail(reason: string, detail?: string): Record<string, string> {
  return IS_DEV && detail ? { error: reason, detail } : { error: reason };
}

async function parseMultipart(req: NextRequest): Promise<ParseResult> {
  const form = await req.formData();
  const sessionIdRaw = String(form.get("sessionId") ?? "anon").trim();
  const sessionId = sessionIdRaw || "anon";

  const textInput = String(form.get("chatInput") ?? "").trim();
  if (textInput) {
    return { ok: true, value: { sessionId, chatInput: textInput, source: "text" } };
  }

  const audioField = form.get("audio") ?? form.get("file");
  if (!(audioField instanceof Blob)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "missing_chat_input_or_audio" },
        { status: 400 },
      ),
    };
  }

  const filename =
    "name" in audioField && typeof audioField.name === "string" && audioField.name
      ? audioField.name
      : "speech.webm";

  const stt = await transcribeAudio(audioField, filename);
  if (!stt.ok) {
    if (stt.reason === "no_api_key") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "GROQ_API_KEY not configured for audio transcription" },
          { status: 500 },
        ),
      };
    }
    if (stt.reason === "upstream") {
      return {
        ok: false,
        response: NextResponse.json(
          makeDetail("stt_upstream_error", stt.detail),
          { status: 502 },
        ),
      };
    }
    if (stt.reason === "network") {
      return {
        ok: false,
        response: NextResponse.json(
          makeDetail("stt_network_error", stt.detail),
          { status: 502 },
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "empty_transcript" },
        { status: 400 },
      ),
    };
  }

  return { ok: true, value: { sessionId, chatInput: stt.text, source: "audio" } };
}

async function parseJson(req: NextRequest): Promise<ParseResult> {
  const body = (await req.json().catch(() => ({}))) as ChatPayload;
  const sessionIdRaw = String(body.sessionId ?? "anon").trim();
  const chatInputRaw = String(body.chatInput ?? body.text ?? "").trim();

  if (!chatInputRaw) {
    return {
      ok: false,
      response: NextResponse.json({ error: "empty_chat_input" }, { status: 400 }),
    };
  }

  return {
    ok: true,
    value: {
      sessionId: sessionIdRaw || "anon",
      chatInput: chatInputRaw,
      source: "text",
    },
  };
}

async function parseIncoming(req: NextRequest): Promise<ParseResult> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return parseMultipart(req);
  }
  return parseJson(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  // Force legacy path if explicitly requested.
  if (BACKEND_MODE === "n8n" && WEBHOOK) {
    return postWithLegacyN8n(req);
  }

  // For voice input without GROQ key, keep the app working by using legacy n8n.
  if (isMultipart && !HAS_GROQ && WEBHOOK) {
    console.warn("[/api/chat] GROQ_API_KEY missing, using n8n fallback for audio request");
    return postWithLegacyN8n(req);
  }

  const parsed = await parseIncoming(req);
  if (!parsed.ok) return parsed.response;

  const { sessionId, chatInput, source } = parsed.value;
  const retrievedFaqs = searchFaqs(chatInput, 6);
  const bestFaqHit = getBestFaqHit(chatInput);
  const history = getSessionTurns(sessionId);

  if (source === "audio") {
    console.info("[/api/chat] transcription:", chatInput.slice(0, 200));
  }

  let output = "";
  const canUseFastFaq = source === "audio" && Boolean(bestFaqHit?.strong);

  if (canUseFastFaq && bestFaqHit) {
    output = bestFaqHit.faq.answer;
    console.info(
      "[/api/chat] fast faq path:",
      `faq=${bestFaqHit.faq.id}`,
      `score=${bestFaqHit.score.toFixed(2)}`,
    );
  } else {
    const llm = await askMistral({ chatInput, history, retrievedFaqs });
    if (llm.ok) {
      output = sanitizeDeadEndAnswer(llm.output, chatInput, retrievedFaqs[0]?.answer ?? null);
    } else {
      if (llm.reason === "upstream") {
        console.error("[/api/chat] mistral upstream error:", llm.status, llm.detail.slice(0, 200));
      } else if (llm.reason === "network") {
        console.error("[/api/chat] mistral network error:", llm.detail);
      } else {
        console.warn("[/api/chat] mistral fallback:", llm.reason);
      }
      output = fallbackReply(chatInput, retrievedFaqs[0]?.answer ?? null);
    }
  }

  const suggestions = proposeFollowUpQuestions(chatInput, retrievedFaqs, 6);

  appendSessionTurn(sessionId, "user", chatInput);
  appendSessionTurn(sessionId, "assistant", output);

  // TTS failures do not fail the whole request — the client still gets text.
  const audioUrl = await synthesizeToAudioUrl(output);

  const reply: Reply = { output, audioUrl, sessionId, suggestions };
  return NextResponse.json(reply);
}
