import rows from "@/lib/data/fptFaqs.json";

export type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
  text: string;
};

export const FAQS = rows as FaqItem[];

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
};

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
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
      if (alias.length > 1 && !STOPWORDS.has(alias)) expanded.add(alias);
    }
  }
  return [...expanded];
}

function scoreFaq(faq: FaqItem, queryNorm: string, queryTokens: string[]): number {
  const qNorm = normalize(faq.question);
  const aNorm = normalize(faq.answer);
  const cNorm = normalize(faq.category);
  const qTokenSet = new Set(tokenize(qNorm));
  const aTokenSet = new Set(tokenize(aNorm));
  const cTokenSet = new Set(tokenize(cNorm));

  let score = 0;

  if (queryNorm && qNorm.includes(queryNorm)) score += 18;
  if (queryNorm && aNorm.includes(queryNorm)) score += 10;

  for (const token of queryTokens) {
    if (qTokenSet.has(token)) score += 4;
    if (aTokenSet.has(token)) score += 1.6;
    if (cTokenSet.has(token)) score += 2;
  }

  const queryHasArabic = /[\u0600-\u06FF]/.test(queryNorm);
  if (queryHasArabic && /[\u0600-\u06FF]/.test(faq.answer)) score += 2;

  return score;
}

export function searchFaqs(query: string, limit = 6): FaqItem[] {
  const queryNorm = normalize(query);
  const queryTokens = expandTokens(tokenize(query));
  if (!queryNorm) return [];

  const ranked = FAQS.map((faq) => ({ faq, score: scoreFaq(faq, queryNorm, queryTokens) }))
    .filter((row) => row.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.faq);

  return ranked;
}
