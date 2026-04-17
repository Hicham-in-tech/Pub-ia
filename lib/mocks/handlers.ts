import { http, HttpResponse, delay } from "msw";
import { makeBabbleWav } from "./tone";

type ChatPayload = {
  sessionId?: string;
  chatInput?: string;
};

const FR_REPLIES = [
  "Bienvenue à la Faculté Polydisciplinaire de Taroudant. Je peux vous parler des filières, de l'inscription ou de la vie étudiante.",
  "Les inscriptions pour la prochaine rentrée s'ouvrent en juillet. Voulez-vous que je vous explique les démarches ?",
  "La FPT propose des licences en sciences, en lettres et en économie. Quelle filière vous intéresse ?",
];

const AR_REPLIES = [
  "مرحبا بك في الكلية متعددة التخصصات بتارودانت. يمكنني إخبارك عن الشعب، التسجيل أو الحياة الطلابية.",
  "التسجيل للموسم المقبل يفتح في يوليوز. هل تود أن أشرح لك الخطوات؟",
];

let turn = 0;

export const handlers = [
  http.post("/api/chat", async ({ request }) => {
    // realistic latency for the "thinking" state
    await delay(1500 + Math.random() * 2000);

    let input = "";
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as ChatPayload;
      input = body.chatInput ?? "";
    } else if (contentType.includes("multipart/form-data")) {
      const form = await request.formData().catch(() => null);
      input = (form?.get("chatInput") as string) ?? "";
    }

    const wantsAr = /[\u0600-\u06FF]/.test(input);
    turn += 1;
    const arr = wantsAr ? AR_REPLIES : FR_REPLIES;
    const output = arr[turn % arr.length] ?? arr[0]!;
    const audioUrl = makeBabbleWav({ seconds: 1.6 + Math.random() * 1.4, seed: turn });

    return HttpResponse.json({
      output,
      audioUrl,
      sessionId: `mock-${turn}`,
    });
  }),
];
