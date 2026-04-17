import { NextRequest, NextResponse } from "next/server";
import { putAudio } from "@/lib/audioCache";
import { appendSessionTurn, getSessionTurns } from "@/lib/chatMemory";
import { proposeFollowUpQuestions, searchFaqs } from "@/lib/fptFaqs";
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

  let audioUrl: string | null = null;
  if (output.trim()) {
    try {
      const tts = await synthesize(output);
      if (tts.ok) {
        const id = putAudio(tts.bytes, tts.mimeType);
        audioUrl = `/api/audio/${id}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[/api/chat] tts after n8n failed:", msg);
    }
  }

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
    /(je\s+n('| )?ai\s+pas|je\s+ne\s+sais\s+pas|i\s+do\s+not\s+know|i\s+don't\s+know|ما\s*عرفتش|لا\s+اعرف|لا\s+أعرف)/i;

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
  const history = getSessionTurns(sessionId);

  if (source === "audio") {
    console.info("[/api/chat] transcription:", chatInput.slice(0, 200));
  }

  let output = "";
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

  const suggestions = proposeFollowUpQuestions(chatInput, retrievedFaqs, 6);

  appendSessionTurn(sessionId, "user", chatInput);
  appendSessionTurn(sessionId, "assistant", output);

  // Fire TTS directly against ElevenLabs. Synthesis failures don't fail the
  // whole request — the client just shows text without audio.
  let audioUrl: string | null = null;
  if (output.trim()) {
    try {
      const tts = await synthesize(output);
      if (tts.ok) {
        const id = putAudio(tts.bytes, tts.mimeType);
        audioUrl = `/api/audio/${id}`;
        console.info(
          "[/api/chat] tts cached:",
          `id=${id}`,
          `bytes=${tts.bytes.byteLength}`,
          `outputLen=${output.length}`,
        );
      } else if (tts.reason === "upstream") {
        console.error(
          "[/api/chat] elevenlabs upstream error:",
          tts.status,
          tts.detail.slice(0, 200),
        );
      } else if (tts.reason === "network") {
        console.error("[/api/chat] elevenlabs network error:", tts.detail);
      } else {
        console.warn("[/api/chat] tts skipped:", tts.reason);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[/api/chat] tts threw unexpectedly:", msg);
    }
  }

  const reply: Reply = { output, audioUrl, sessionId, suggestions };
  return NextResponse.json(reply);
}
