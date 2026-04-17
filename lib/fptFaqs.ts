import baseRows from "@/lib/data/fptFaqs.json";
import structuredRowsRaw from "@/lib/data/fptTaroudant.json";

export type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  text: string;
};

type ProgramItem = { title: string; department: string; url: string };
type EventItem = { date: string; title: string; url: string };
type NoticeItem = { date: string; title: string; "filières": string[] };
type PartnerItem = { name: string; url: string };

type StructuredData = {
  institution: {
    name: string;
    abbreviation: string;
    university: string;
    founded: number;
    dean: string;
    website: string;
    facebook: string;
    youtube: string;
    online_courses: string;
    digital_space: string;
    student_health_insurance: string;
  };
  departments: string[];
  formations: {
    masters: ProgramItem[];
    licences_fondamentales: ProgramItem[];
    licences_professionnelles: ProgramItem[];
  };
  student_space: Record<string, string>;
  research: Record<string, string>;
  recent_events: EventItem[];
  recent_student_notices: NoticeItem[];
  partners: PartnerItem[];
};

const STOPWORDS = new Set([
  "a",
  "à",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "est",
  "et",
  "la",
  "le",
  "les",
  "ou",
  "où",
  "par",
  "pour",
  "que",
  "qui",
  "sur",
  "un",
  "une",
  "quoi",
  "quel",
  "quelle",
  "quelles",
  "quels",
  "svp",
  "stp",
  "pls",
  "please",
  "the",
  "is",
  "are",
  "what",
  "how",
  "when",
  "where",
]);

const TOKEN_ALIASES: Record<string, string[]> = {
  fpt: ["faculte", "polydisciplinaire", "taroudant"],
  formation: ["filiere", "filières", "filiere", "parcours", "programme", "licence", "master"],
  filiere: ["formation", "parcours", "programme"],
  filières: ["formation", "parcours", "programme"],
  orientation: ["formation", "filiere", "master", "licence"],
  inscription: ["admission", "candidature", "preinscription", "dossier", "tawjihi"],
  admission: ["inscription", "candidature", "preinscription", "dossier"],
  contact: ["telephone", "email", "site", "adresse"],
  ia: ["intelligence", "artificielle", "big", "data"],
  ta: ["temps", "amenage", "alternance"],
  lea: ["langues", "etrangeres", "appliquees"],
  macq: ["methodes", "analyse", "controle", "qualite"],
  bbe: ["biosciences", "biotechnologie", "environnement"],
  gi: ["genie", "informatique"],
  cacq: ["chimie", "analytique", "controle", "qualite"],
  eeia: ["efficacite", "energetique", "industrielle", "agricole"],
  sie: ["sciences", "ingenierie", "eau"],
  vrhdd: ["valorisation", "ressources", "halieutiques", "developpement", "durable"],
  mib: ["mathematiques", "informatique"],
  emploi: ["emploi", "temps", "horaire"],
  examens: ["calendrier", "reglement", "session", "rattrapage"],
};

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  formations: [
    "Quelles formations sont disponibles à la FPT ?",
    "Quels sont les masters proposés à la FPT ?",
    "Quelles licences professionnelles existent à la FPT ?",
  ],
  masters: [
    "Quels masters peut-on intégrer à la FPT ?",
    "Comment candidater à un master de la FPT ?",
    "Le master Big Data et IA est-il disponible ?",
  ],
  licences: [
    "Quelles licences sont proposées à la FPT ?",
    "Quels parcours existent en Sciences et Techniques ?",
    "La filière Génie Informatique est-elle disponible ?",
  ],
  admissions: [
    "Comment s'inscrire en licence à la FPT ?",
    "Quels documents faut-il pour la candidature ?",
    "Où suivre les avis aux étudiants ?",
  ],
  departments: [
    "Quels sont les départements de la FPT ?",
    "Quelle formation dépend du département Physique-Chimie ?",
    "Que propose le département Mathématiques et Informatique ?",
  ],
  contact: [
    "Quel est le site officiel de la FPT ?",
    "Comment contacter la FPT ?",
    "Quel est le numéro du standard de la FPT ?",
  ],
  examens: [
    "Où consulter le calendrier des examens ?",
    "Où se trouve le règlement des examens ?",
    "Comment trouver les listes des groupes ?",
  ],
  "vie-etudiante": [
    "Comment accéder à l'espace numérique des étudiants ?",
    "Où se connecte-t-on aux cours en ligne ?",
    "Comment accéder à l'assurance AMO étudiante ?",
  ],
  research: [
    "Où consulter les structures de recherche ?",
    "Comment accéder aux publications scientifiques ?",
    "Où trouver les informations de formation doctorale ?",
  ],
  notices: [
    "Y a-t-il des avis récents pour GI ?",
    "Y a-t-il des avis récents pour BBE ?",
    "Où consulter tous les avis aux étudiants ?",
  ],
};

const DEFAULT_SUGGESTIONS = [
  "Quelles formations sont disponibles à la FPT ?",
  "Quels masters peut-on intégrer à la FPT ?",
  "Comment s'inscrire en licence à la FPT ?",
  "Où trouver les emplois du temps ?",
  "Quel est le lien des avis aux étudiants ?",
  "Comment contacter la FPT ?",
];

type TopicId =
  | "formations"
  | "sciences-info"
  | "admissions"
  | "examens"
  | "contact"
  | "vie-etudiante"
  | "research"
  | "events";

const TOPIC_KEYWORDS: Record<TopicId, string[]> = {
  formations: [
    "formation",
    "formations",
    "filiere",
    "filieres",
    "filières",
    "master",
    "masters",
    "licence",
    "licences",
    "programme",
    "parcours",
    "orientation",
    "etudier",
    "study",
    "تكوين",
    "ماستر",
    "إجازة",
    "شعبة",
  ],
  "sciences-info": [
    "info",
    "informatique",
    "ia",
    "intelligence",
    "artificielle",
    "science",
    "sciences",
    "siance",
    "scinece",
    "data",
    "big",
    "computer",
    "programming",
    "mip",
    "gi",
    "bbe",
    "cacq",
    "eeia",
    "sie",
  ],
  admissions: [
    "inscription",
    "admission",
    "admissions",
    "candidature",
    "dossier",
    "preinscription",
    "tawjihi",
    "selection",
    "documents",
    "document",
    "inscrire",
    "register",
    "تسجيل",
    "ترشيح",
    "ولوج",
  ],
  examens: [
    "exam",
    "examen",
    "examens",
    "rattrapage",
    "notes",
    "note",
    "session",
    "calendrier",
    "emploi",
    "horaire",
    "groupes",
    "tp",
    "td",
    "امتحان",
    "نقط",
  ],
  contact: [
    "contact",
    "telephone",
    "tel",
    "email",
    "mail",
    "adresse",
    "site",
    "web",
    "facebook",
    "youtube",
    "standard",
    "هاتف",
    "اتصال",
    "موقع",
  ],
  "vie-etudiante": [
    "etudiant",
    "etudiants",
    "etudiante",
    "amo",
    "assurance",
    "moodle",
    "cours",
    "ecours",
    "ene",
    "numerique",
    "club",
    "association",
    "طالب",
    "طلبة",
  ],
  research: [
    "recherche",
    "research",
    "publication",
    "publications",
    "doctorale",
    "doctorat",
    "projet",
    "projets",
    "brevets",
    "cooperation",
  ],
  events: [
    "evenement",
    "events",
    "seminaire",
    "séminaire",
    "actualite",
    "news",
    "avis",
    "annonce",
    "notices",
    "notice",
    "ندوة",
    "إعلان",
  ],
};

const TOPIC_CATEGORY_ORDER: Record<TopicId, string[]> = {
  formations: ["formations", "masters", "licences", "licences-pro", "departments", "admissions"],
  "sciences-info": ["formations", "masters", "licences", "departments", "admissions"],
  admissions: ["admissions", "formations", "masters", "licences", "contact"],
  examens: ["examens", "notices", "vie-etudiante", "admissions"],
  contact: ["contact", "about", "vie-etudiante"],
  "vie-etudiante": ["vie-etudiante", "examens", "notices", "contact"],
  research: ["research", "about", "contact"],
  events: ["events", "notices", "vie-etudiante", "contact"],
};

const data = structuredRowsRaw as StructuredData;

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string): string[] {
  const normalized = normalize(input);
  const terms = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  return terms.filter((term) => term.length > 1 && !STOPWORDS.has(term));
}

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const aliases = TOKEN_ALIASES[token];
    if (!aliases) continue;
    for (const alias of aliases) {
      const aliasNorm = normalize(alias);
      if (aliasNorm.length > 1 && !STOPWORDS.has(aliasNorm)) expanded.add(aliasNorm);
    }
  }
  return [...expanded];
}

function compactLabel(input: string): string {
  return input
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeFaq(id: string, category: string, question: string, answer: string): FaqItem {
  return {
    id,
    category,
    question,
    answer,
    text: `Q: ${question}\nR: ${answer}`,
  };
}

function buildStructuredFaqs(source: StructuredData): FaqItem[] {
  const generated: FaqItem[] = [];

  generated.push(
    makeFaq(
      "structured-inst-001",
      "about",
      "Quel est le nom officiel de la FPT et son université de rattachement ?",
      `${source.institution.name} (${source.institution.abbreviation}) est rattachée à ${source.institution.university}. Fondée en ${source.institution.founded}, elle est dirigée par ${source.institution.dean}. Site officiel: ${source.institution.website}`,
    ),
  );
  generated.push(
    makeFaq(
      "structured-inst-002",
      "contact",
      "Quels sont les liens numériques officiels de la FPT ?",
      `Site: ${source.institution.website}. Facebook: ${source.institution.facebook}. YouTube: ${source.institution.youtube}. Cours en ligne: ${source.institution.online_courses}. Espace numérique: ${source.institution.digital_space}. AMO étudiante: ${source.institution.student_health_insurance}.`,
    ),
  );

  generated.push(
    makeFaq(
      "structured-dept-001",
      "departments",
      "Quels sont les départements de la FPT ?",
      `La FPT compte ${source.departments.length} départements: ${source.departments.join(" ; ")}.`,
    ),
  );

  const allPrograms: Array<ProgramItem & { level: "master" | "licence-fondamentale" | "licence-professionnelle" }> = [
    ...source.formations.masters.map((item) => ({ ...item, level: "master" as const })),
    ...source.formations.licences_fondamentales.map((item) => ({
      ...item,
      level: "licence-fondamentale" as const,
    })),
    ...source.formations.licences_professionnelles.map((item) => ({
      ...item,
      level: "licence-professionnelle" as const,
    })),
  ];

  generated.push(
    makeFaq(
      "structured-formations-001",
      "formations",
      "Quelles formations sont proposées à la FPT ?",
      `La FPT propose ${source.formations.masters.length} masters, ${source.formations.licences_fondamentales.length} licences fondamentales et ${source.formations.licences_professionnelles.length} licences professionnelles. Posez une question précise sur une filière pour obtenir le lien direct du programme.`,
    ),
  );

  for (const [index, program] of allPrograms.entries()) {
    generated.push(
      makeFaq(
        `structured-program-${String(index + 1).padStart(3, "0")}`,
        program.level === "master"
          ? "masters"
          : program.level === "licence-fondamentale"
            ? "licences"
            : "licences-pro",
        `Donnez-moi des informations sur ${program.title}.`,
        `${program.title} relève du département ${program.department}. Pour les détails officiels (conditions d'accès, modules et calendrier), consultez: ${program.url}`,
      ),
    );
  }

  const byDepartment = new Map<string, ProgramItem[]>();
  for (const program of allPrograms) {
    const list = byDepartment.get(program.department) ?? [];
    list.push(program);
    byDepartment.set(program.department, list);
  }

  for (const [index, department] of source.departments.entries()) {
    const list = byDepartment.get(department) ?? [];
    const titles = list.map((item) => item.title).join(" ; ");
    generated.push(
      makeFaq(
        `structured-dept-${String(index + 2).padStart(3, "0")}`,
        "departments",
        `Que propose le département ${department} ?`,
        titles
          ? `Le département ${department} propose notamment: ${titles}.`
          : `Le département ${department} est listé par la FPT. Consultez le site officiel pour les ouvertures de filières: ${source.institution.website}`,
      ),
    );
  }

  for (const [key, url] of Object.entries(source.student_space)) {
    const label = compactLabel(key);
    generated.push(
      makeFaq(
        `structured-student-${normalize(key).replace(/[^a-z0-9]+/g, "-")}`,
        "vie-etudiante",
        `Quel est le lien pour ${label} ?`,
        `Le lien officiel pour ${label} est: ${url}`,
      ),
    );
  }

  for (const [key, url] of Object.entries(source.research)) {
    const label = compactLabel(key);
    generated.push(
      makeFaq(
        `structured-research-${normalize(key).replace(/[^a-z0-9]+/g, "-")}`,
        "research",
        `Où trouver ${label} ?`,
        `Vous pouvez consulter ${label} sur: ${url}`,
      ),
    );
  }

  if (source.recent_events.length > 0) {
    const eventLines = source.recent_events
      .slice(0, 7)
      .map((item) => `${item.date}: ${item.title} (${item.url})`)
      .join(" ; ");

    generated.push(
      makeFaq(
        "structured-events-001",
        "events",
        "Quels sont les événements récents de la FPT ?",
        `Voici les événements récents publiés par la FPT: ${eventLines}`,
      ),
    );
  }

  if (source.recent_student_notices.length > 0) {
    const noticeLines = source.recent_student_notices
      .slice(0, 10)
      .map((item) => {
        const tracks = item["filières"].length > 0 ? ` [${item["filières"].join(", ")}]` : "";
        return `${item.date}: ${item.title}${tracks}`;
      })
      .join(" ; ");

    generated.push(
      makeFaq(
        "structured-notices-001",
        "notices",
        "Quels sont les avis récents aux étudiants ?",
        `Avis récents publiés: ${noticeLines}. Lien général des avis: ${source.student_space.student_notices}`,
      ),
    );
  }

  if (source.partners.length > 0) {
    const partnerLines = source.partners
      .map((item) => `${item.name} (${item.url})`)
      .join(" ; ");
    generated.push(
      makeFaq(
        "structured-partners-001",
        "partnerships",
        "Quels sont les partenaires institutionnels mentionnés par la FPT ?",
        `Partenaires mentionnés: ${partnerLines}`,
      ),
    );
  }

  return generated;
}

function dedupeFaqs(rows: FaqItem[]): FaqItem[] {
  const seen = new Set<string>();
  const out: FaqItem[] = [];

  for (const row of rows) {
    const key = `${normalize(row.question)}|${normalize(row.answer).slice(0, 180)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

const generatedRows = buildStructuredFaqs(data);
export const FAQS = dedupeFaqs([...(baseRows as FaqItem[]), ...generatedRows]);

function fuzzyTokenMatchScore(token: string, set: Set<string>): number {
  if (set.has(token)) return 1;

  let best = 0;
  for (const candidate of set) {
    if (candidate.length < 2) continue;
    if (candidate.startsWith(token) || token.startsWith(candidate)) {
      if (Math.min(candidate.length, token.length) >= 3) {
        best = Math.max(best, 0.72);
      }
    } else if (candidate.includes(token) || token.includes(candidate)) {
      if (Math.min(candidate.length, token.length) >= 4) {
        best = Math.max(best, 0.42);
      }
    }
  }

  return best;
}

function scoreFaq(faq: FaqItem, queryNorm: string, queryTokens: string[]): number {
  const qNorm = normalize(faq.question);
  const aNorm = normalize(faq.answer);
  const cNorm = normalize(faq.category);
  const qTokenSet = new Set(tokenize(qNorm));
  const aTokenSet = new Set(tokenize(aNorm));
  const cTokenSet = new Set(tokenize(cNorm));

  let score = 0;

  if (queryNorm && qNorm === queryNorm) score += 26;
  if (queryNorm && qNorm.includes(queryNorm)) score += 16;
  if (queryNorm && aNorm.includes(queryNorm)) score += 9;

  for (const token of queryTokens) {
    score += fuzzyTokenMatchScore(token, qTokenSet) * 4.4;
    score += fuzzyTokenMatchScore(token, aTokenSet) * 1.8;
    score += fuzzyTokenMatchScore(token, cTokenSet) * 2.5;
  }

  const queryHasArabic = /[\u0600-\u06FF]/.test(queryNorm);
  if (queryHasArabic && /[\u0600-\u06FF]/.test(faq.answer)) score += 2.4;

  if (queryTokens.some((token) => ["formation", "filiere", "master", "licence"].includes(token))) {
    if (["formations", "masters", "licences", "licences-pro", "departments"].includes(faq.category)) {
      score += 2.6;
    }
  }

  return score;
}

function rankedFaqs(query: string): Array<{ faq: FaqItem; score: number }> {
  const queryNorm = normalize(query);
  const queryTokens = expandTokens(tokenize(query));
  if (!queryNorm) return [];

  return FAQS.map((faq) => ({ faq, score: scoreFaq(faq, queryNorm, queryTokens) })).sort(
    (a, b) => b.score - a.score,
  );
}

export type BestFaqHit = {
  faq: FaqItem;
  score: number;
  strong: boolean;
};

export function getBestFaqHit(query: string): BestFaqHit | null {
  const ranked = rankedFaqs(query);
  if (ranked.length === 0) return null;

  const best = ranked[0];
  if (!best) return null;

  const queryNorm = normalize(query);
  const questionNorm = normalize(best.faq.question);
  const queryTokens = expandTokens(tokenize(query));
  const targetTokens = new Set(
    tokenize(`${best.faq.question} ${best.faq.answer} ${best.faq.category}`),
  );

  let overlap = 0;
  for (const token of queryTokens) {
    if (targetTokens.has(token)) overlap += 1;
  }

  const threshold = queryTokens.length <= 2 ? 7.2 : 9.2;
  const overlapNeeded = queryTokens.length <= 1 ? 1 : 2;
  const strong =
    (queryNorm.length >= 8 && questionNorm.includes(queryNorm)) ||
    best.score >= threshold ||
    overlap >= overlapNeeded;

  return { faq: best.faq, score: best.score, strong };
}

function resolveTopicByKeywords(queryTokens: string[]): TopicId | null {
  if (queryTokens.length === 0) return null;

  let bestTopic: TopicId | null = null;
  let bestScore = 0;

  for (const topic of Object.keys(TOPIC_KEYWORDS) as TopicId[]) {
    const keywords = TOPIC_KEYWORDS[topic];
    let score = 0;

    for (const token of queryTokens) {
      if (keywords.includes(token)) {
        score += 3;
        continue;
      }

      for (const keyword of keywords) {
        if (
          (token.startsWith(keyword) || keyword.startsWith(token)) &&
          Math.min(token.length, keyword.length) >= 3
        ) {
          score += 1.15;
        } else if (
          (token.includes(keyword) || keyword.includes(token)) &&
          Math.min(token.length, keyword.length) >= 4
        ) {
          score += 0.58;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  return bestScore >= 1.1 ? bestTopic : null;
}

function keywordFallbackFaqs(
  query: string,
  ranked: Array<{ faq: FaqItem; score: number }>,
  limit: number,
): FaqItem[] {
  const out: FaqItem[] = [];
  const seen = new Set<string>();

  const push = (faq: FaqItem) => {
    if (seen.has(faq.id)) return;
    seen.add(faq.id);
    out.push(faq);
  };

  for (const hit of ranked) {
    if (hit.score <= 0) continue;
    push(hit.faq);
    if (out.length >= Math.min(limit, 3)) break;
  }

  const queryTokens = expandTokens(tokenize(query));
  const topic = resolveTopicByKeywords(queryTokens);
  const categories = topic
    ? TOPIC_CATEGORY_ORDER[topic]
    : ["formations", "masters", "licences", "admissions", "departments", "contact"];

  for (const category of categories) {
    const categoryHit = ranked.find((hit) => hit.faq.category === category);
    if (categoryHit) push(categoryHit.faq);

    const anchor = FAQS.find((faq) => faq.category === category);
    if (anchor) push(anchor);

    if (out.length >= limit) return out.slice(0, limit);
  }

  for (const faq of FAQS) {
    push(faq);
    if (out.length >= limit) break;
  }

  return out.slice(0, limit);
}

export function searchFaqs(query: string, limit = 6): FaqItem[] {
  const hits = rankedFaqs(query);
  if (hits.length === 0) return [];

  const queryTokens = expandTokens(tokenize(query));
  const minScore = queryTokens.length <= 1 ? 2.2 : 3.4;

  const confident = hits.filter((hit) => hit.score >= minScore).slice(0, limit);
  if (confident.length > 0) return confident.map((hit) => hit.faq);

  const loose = hits.filter((hit) => hit.score > 0.85).slice(0, limit);
  if (loose.length > 0) return loose.map((hit) => hit.faq);

  return keywordFallbackFaqs(query, hits, limit);
}

export function proposeFollowUpQuestions(query: string, matches: FaqItem[], limit = 6): string[] {
  const out: string[] = [];
  const queryNorm = normalize(query);
  const queryTokens = expandTokens(tokenize(queryNorm));

  const pushUnique = (question: string) => {
    const normalized = normalize(question);
    if (!normalized) return;
    if (normalized === queryNorm) return;
    if (out.some((item) => normalize(item) === normalized)) return;
    out.push(question);
  };

  const wantsFormation = queryTokens.some((token) =>
    ["formation", "filiere", "filières", "licence", "master", "orientation", "inscription", "admission"].includes(
      token,
    ),
  );

  if (wantsFormation) {
    for (const question of CATEGORY_SUGGESTIONS.formations ?? []) {
      pushUnique(question);
    }
  }

  for (const match of matches.slice(0, 4)) {
    for (const question of CATEGORY_SUGGESTIONS[match.category] ?? []) {
      pushUnique(question);
    }

    if (match.question.length <= 96) {
      pushUnique(match.question);
    }
  }

  for (const question of DEFAULT_SUGGESTIONS) {
    pushUnique(question);
  }

  return out.slice(0, limit);
}
