import { NextRequest, NextResponse } from "next/server";
import { putAudio } from "@/lib/audioCache";
import { synthesize } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK = process.env.N8N_WEBHOOK_URL;
const IS_DEV = process.env.NODE_ENV !== "production";

type N8nJson = {
  output?: string;
  text?: string;
  message?: string;
  sessionId?: string;
};

type Reply = { output: string; audioUrl: string | null; sessionId: string | null };

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!WEBHOOK) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL not configured" },
      { status: 500 },
    );
  }

  let upstream: Response;
  try {
    upstream = await forwardToN8n(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[/api/chat] upstream unreachable:", msg);
    return NextResponse.json(
      { error: "upstream_unreachable", detail: IS_DEV ? msg : undefined },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    console.error(
      `[/api/chat] upstream ${upstream.status} from ${WEBHOOK}:\n${text.slice(0, 2000)}`,
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
    console.error("[/api/chat] failed to read upstream body:", msg);
    return NextResponse.json(
      { error: "upstream_read_failed", detail: IS_DEV ? msg : undefined },
      { status: 502 },
    );
  }
  let raw: N8nJson | N8nJson[];
  try {
    raw = JSON.parse(responseText) as N8nJson | N8nJson[];
  } catch {
    console.error("[/api/chat] non-JSON upstream body:", responseText.slice(0, 500));
    return NextResponse.json(
      { error: "bad_json_from_upstream", ...upstreamDebug(upstream.status, responseText) },
      { status: 502 },
    );
  }

  const body: N8nJson = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  const output = body.output ?? body.text ?? body.message ?? "";
  const sessionId = body.sessionId ?? null;

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

  const reply: Reply = { output, audioUrl, sessionId };
  return NextResponse.json(reply);
}
