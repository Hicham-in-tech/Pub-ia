import type { MemoryTurn } from "@/lib/chatMemory";
import type { FaqItem } from "@/lib/fptFaqs";

const API_URL = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es Rouda, l'assistante vocale officielle de la Faculté Polydisciplinaire de Taroudant (FPT).
Tu réponds aux futurs étudiants, étudiants actuels, parents et visiteurs lors de la journée d'orientation.

RÈGLES ABSOLUES
- Utilise uniquement les informations du bloc FAQ_CONTEXT fourni dans le message utilisateur.
- N'invente jamais de chiffres, noms, dates ou programmes qui ne sont pas présents dans FAQ_CONTEXT.
- Si la question sort du périmètre de la FPT ou si FAQ_CONTEXT est vide/non pertinent, dis-le clairement et propose de rediriger vers le site https://fpt.ac.ma ou le standard +212 05 28 55 10 10.
- Réponse concise: 2 à 4 phrases, ton chaleureux, niveau de langue accessible à un bachelier.
- Pas de liste à puces.
- Langue: réponds dans la langue de l'utilisateur (français par défaut, sinon darija/arabe/anglais si l'utilisateur l'utilise).
- Si un contact, une adresse ou un lien est demandé, donne l'information telle quelle.`;

function env(name: string, fallback?: string): string | undefined {
  const ctx = globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };
  return ctx.process?.env?.[name] ?? fallback;
}

function faqContext(rows: FaqItem[]): string {
  if (rows.length === 0) return "AUCUN RESULTAT FAQ";
  return rows
    .map(
      (row, idx) =>
        `[${idx + 1}] faq_id=${row.id} | category=${row.category}\nQuestion: ${row.question}\nRéponse: ${row.answer}`,
    )
    .join("\n\n");
}

function toMistralContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  const textParts = content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const p = part as { type?: string; text?: string };
      return p.type === "text" ? (p.text ?? "") : "";
    })
    .filter(Boolean);

  return textParts.join("\n").trim();
}

export type MistralResult =
  | { ok: true; output: string }
  | { ok: false; reason: "no_api_key" | "empty_response" }
  | { ok: false; reason: "upstream"; status: number; detail: string }
  | { ok: false; reason: "network"; detail: string };

export async function askMistral(params: {
  chatInput: string;
  history: MemoryTurn[];
  retrievedFaqs: FaqItem[];
}): Promise<MistralResult> {
  const apiKey = env("MISTRAL_API_KEY");
  if (!apiKey) return { ok: false, reason: "no_api_key" };

  const model = env("MISTRAL_MODEL", "mistral-large-latest")!;
  const history = params.history.slice(-8).map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  const userPrompt = [
    `QUESTION_UTILISATEUR:\n${params.chatInput}`,
    `FAQ_CONTEXT:\n${faqContext(params.retrievedFaqs)}`,
    "Réponds maintenant selon les règles du système.",
  ].join("\n\n");

  const payload = {
    model,
    temperature: 0.2,
    max_tokens: 280,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: userPrompt },
    ],
  };

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
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
      detail: detail.slice(0, 800),
    };
  }

  let output = "";
  try {
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    output = toMistralContent(data.choices?.[0]?.message?.content).trim();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "network", detail };
  }

  if (!output) return { ok: false, reason: "empty_response" };
  return { ok: true, output };
}
