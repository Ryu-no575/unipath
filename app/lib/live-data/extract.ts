import "server-only";

/**
 * Deterministic, regex-based structured extraction from an official page's
 * visible text -- deliberately NOT an LLM call. Every extractor either finds
 * a clearly-stated value near an unambiguous keyword, or returns null (see
 * AGENTS.md task notes on Extraction: "if not clearly present, return
 * null"). `confidence` reflects how directly the match was tied to its
 * keyword, never how plausible the value "sounds".
 */

export type Confidence = "high" | "medium" | "low";

export interface ExtractedField {
  value: string;
  confidence: Confidence;
}

export type ExtractedFields = Record<string, ExtractedField>;

/**
 * Strips scripts/styles/comments/tags and collapses whitespace so hashing
 * and extraction both operate on the page's visible text, not incidental
 * HTML churn (ad slots, inline timestamps, attribute order, analytics
 * snippets) that would otherwise trigger false "changed" detections.
 */
export function normalizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS =
  "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
const DATE_PATTERN = new RegExp(
  `\\b\\d{1,2}\\s+${MONTHS}\\.?\\s+\\d{4}\\b|\\b${MONTHS}\\.?\\s+\\d{1,2},?\\s+\\d{4}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`,
  "i",
);
const CURRENCY_PATTERN =
  /(EUR|USD|GBP|CHF|SGD|€|\$|£)\s?[\d][\d.,]*(?:\.\d{2})?|[\d][\d.,]*\s?(EUR|USD|GBP|CHF|SGD)/;

function windowAround(text: string, index: number, radius = 100): string {
  return text.slice(Math.max(0, index - radius), index + radius);
}

/** Every window (up to a small cap) in `text` centered on a match of `keywords`. */
function findKeywordWindows(text: string, keywords: RegExp, limit = 6): string[] {
  const flags = keywords.flags.includes("g") ? keywords.flags : `${keywords.flags}g`;
  const re = new RegExp(keywords.source, flags);
  const windows: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    windows.push(windowAround(text, match.index));
    if (windows.length >= limit) break;
    if (match.index === re.lastIndex) re.lastIndex++;
  }
  return windows;
}

export function extractApplicationDeadline(text: string): ExtractedField | null {
  const strictWindows = findKeywordWindows(
    text,
    /application deadline|deadline for applications|apply by|applications close|closing date|registration period/i,
  );
  for (const w of strictWindows) {
    const m = w.match(DATE_PATTERN);
    if (m) return { value: m[0], confidence: "high" };
  }

  // Looser but still date-window-shaped phrasing (e.g. "you can register
  // ... between 17 June 2026 and 16 July 2026") -- takes the *last* date in
  // the window since a registration/application window is usually stated as
  // "from X to Y" and Y (the close) is what matters here, not X (the open).
  const registrationWindows = findKeywordWindows(text, /\bregist(er|ration)\b/i, 6);
  for (const w of registrationWindows) {
    const dates = w.match(new RegExp(DATE_PATTERN.source, "gi"));
    if (dates && dates.length > 0) return { value: dates[dates.length - 1], confidence: "medium" };
  }

  const looseWindows = findKeywordWindows(text, /\bdeadline\b/i);
  for (const w of looseWindows) {
    const m = w.match(DATE_PATTERN);
    if (m) return { value: m[0], confidence: "medium" };
  }

  return null;
}

export function extractTuition(text: string): ExtractedField | null {
  const windows = findKeywordWindows(text, /tuition fee|tuition fees|annual tuition|program fee|programme fee/i);
  for (const w of windows) {
    const m = w.match(CURRENCY_PATTERN);
    if (m) return { value: m[0].trim(), confidence: "high" };
  }
  return null;
}

export function extractApplicationFee(text: string): ExtractedField | null {
  const windows = findKeywordWindows(text, /application fee/i);
  for (const w of windows) {
    const m = w.match(CURRENCY_PATTERN);
    if (m) return { value: m[0].trim(), confidence: "high" };
  }
  return null;
}

export function extractEnglishRequirement(text: string): ExtractedField | null {
  const windows = findKeywordWindows(text, /IELTS|TOEFL|english (language )?(requirement|proficiency)/i);
  for (const w of windows) {
    const ielts = w.match(/IELTS[^\d]{0,12}(\d(?:\.\d)?)/i);
    if (ielts) return { value: `IELTS ${ielts[1]}`, confidence: "high" };
    const toefl = w.match(/TOEFL[^\d]{0,12}(\d{2,3})/i);
    if (toefl) return { value: `TOEFL ${toefl[1]}`, confidence: "high" };
  }
  return null;
}

export function extractPortfolioRequirement(text: string): ExtractedField | null {
  const windows = findKeywordWindows(text, /portfolio/i);
  for (const w of windows) {
    if (/require|submit|must (include|provide|submit)|mandatory|compulsory/i.test(w)) {
      return { value: "required", confidence: "medium" };
    }
  }
  return null;
}

const KNOWN_ENTRANCE_EXAMS = ["ARCHED", "TOLC", "SAT", "ACT", "GRE", "GMAT", "GAOKAO"];

export function extractEntranceExam(text: string): ExtractedField | null {
  for (const exam of KNOWN_ENTRANCE_EXAMS) {
    if (new RegExp(`\\b${exam}\\b`).test(text)) {
      return { value: exam, confidence: "high" };
    }
  }
  const windows = findKeywordWindows(text, /entrance exam|admission test/i);
  if (windows.length > 0) return { value: "entrance exam mentioned", confidence: "low" };
  return null;
}

const KNOWN_LANGUAGES = ["English", "Italian", "French", "German", "Spanish", "Dutch", "Japanese", "Korean", "Chinese"];

export function extractStudyLanguage(text: string): ExtractedField | null {
  const windows = findKeywordWindows(text, /taught in|language of instruction|medium of instruction/i);
  for (const w of windows) {
    for (const lang of KNOWN_LANGUAGES) {
      if (new RegExp(`\\b${lang}\\b`, "i").test(w)) return { value: lang, confidence: "high" };
    }
  }
  return null;
}

/**
 * v1 extraction targets (see AGENTS.md task notes on Extraction): only
 * fields clearly present in the page's visible text are returned. A field
 * absent from the result means "not found", not "confirmed absent" -- the
 * caller must render that as unknown, never as a negative fact.
 */
export function extractStructuredData(normalizedText: string): ExtractedFields {
  const entries: [string, ExtractedField | null][] = [
    ["application_deadline", extractApplicationDeadline(normalizedText)],
    ["tuition", extractTuition(normalizedText)],
    ["application_fee", extractApplicationFee(normalizedText)],
    ["min_english_score", extractEnglishRequirement(normalizedText)],
    ["portfolio_requirement", extractPortfolioRequirement(normalizedText)],
    ["entrance_exam", extractEntranceExam(normalizedText)],
    ["language", extractStudyLanguage(normalizedText)],
  ];

  const result: ExtractedFields = {};
  for (const [key, field] of entries) {
    if (field) result[key] = field;
  }
  return result;
}
