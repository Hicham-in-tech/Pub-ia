const GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

function env(name: string, fallback?: string): string | undefined {
  const ctx = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };
  return ctx.process?.env?.[name] ?? fallback;
}

export type SttResult =
  | { ok: true; text: string }
  | { ok: false; reason: "no_api_key" | "empty_file" | "empty_text" }
  | { ok: false; reason: "upstream"; status: number; detail: string }
  | { ok: false; reason: "network"; detail: string };

export async function transcribeAudio(blob: Blob, filename = "speech.webm"): Promise<SttResult> {
  const apiKey = env("GROQ_API_KEY");
  if (!apiKey) return { ok: false, reason: "no_api_key" };
  if (blob.size === 0) return { ok: false, reason: "empty_file" };

  const model = env("GROQ_STT_MODEL", "whisper-large-v3-turbo")!;

  const form = new FormData();
  form.set("file", blob, filename);
  form.set("model", model);
  form.set("response_format", "json");
  form.set("temperature", "0");

  let res: Response;
  try {
    res = await fetch(GROQ_STT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
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
      detail: detail.slice(0, 600),
    };
  }

  let text = "";
  try {
    const data = (await res.json()) as { text?: string };
    text = (data.text ?? "").trim();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "network", detail };
  }

  if (!text) return { ok: false, reason: "empty_text" };
  return { ok: true, text };
}
