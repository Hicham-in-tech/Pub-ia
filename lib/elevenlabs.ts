/**
 * Server-only ElevenLabs TTS client. Returns an MP3 Uint8Array that the
 * /api/chat route caches and exposes via /api/audio/[id].
 */

const API_BASE = "https://api.elevenlabs.io/v1";

function env(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export type TtsResult =
  | { ok: true; bytes: Uint8Array; mimeType: "audio/mpeg" }
  | { ok: false; reason: "no_api_key" | "empty_text" | "empty_body" }
  | { ok: false; reason: "upstream"; status: number; detail: string }
  | { ok: false; reason: "network"; detail: string };

export async function synthesize(text: string): Promise<TtsResult> {
  const apiKey = env("ELEVENLABS_API_KEY");
  if (!apiKey) return { ok: false, reason: "no_api_key" };

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "empty_text" };

  const voiceId = env("ELEVENLABS_VOICE_ID", "iP95p4xoKVk53GoZ742B")!;
  const modelId = env("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5")!;

  const url = `${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: modelId,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          style: 0.1,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "network", detail };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      ok: false,
      reason: "upstream",
      status: res.status,
      detail: detail.slice(0, 500),
    };
  }

  try {
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) return { ok: false, reason: "empty_body" };
    return { ok: true, bytes, mimeType: "audio/mpeg" };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "network", detail };
  }
}
