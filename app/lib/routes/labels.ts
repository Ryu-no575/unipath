import type { DocumentType } from "@/app/lib/supabase/database.types";
import type { RouteReason, RouteReasonKind, RouteStep, RouteStepType } from "./types";

/** Every key routeStepLabel below can request from the "RouteStepDetails"
 * message namespace -- kept as an explicit union (rather than `string`) so
 * next-intl's generated message types (see global.d.ts) catch a typo or a
 * removed key at compile time instead of silently rendering the raw key. */
export type RouteStepDetailKey =
  | "profileDone"
  | "profileTodo"
  | "languageTestMet"
  | "languageTestMetTarget"
  | "languageTestGeneric"
  | "languageTestTarget"
  | "universitySearch"
  | "shortlistProgress"
  | "shortlistClassification"
  | "documentReady"
  | "documentPrepare"
  | "documentPrepareFor"
  | "portfolioReady"
  | "portfolioPrepare"
  | "applicationSubmit"
  | "applicationProgress"
  | "scholarship"
  | "interview"
  | "admissionWait"
  | "admissionAccepted"
  | "payment"
  | "visa"
  | "housing"
  | "travel"
  | "arrival";

type Values = Record<string, string | number>;

export interface RouteStepLabel {
  title: string;
  detail: string;
}

export interface RouteStepTranslators {
  /** "RouteStepDetails" namespace. */
  stepDetails: (key: RouteStepDetailKey, values?: Values) => string;
  /** "RouteStepTypeOptions" namespace. */
  stepTypes: (key: RouteStepType) => string;
  documentTypes: (key: DocumentType) => string;
}

/** Resolves a RouteStep's title + detail sentence -- always from real,
 * already-computed fields on the step (see app/lib/routes/steps.ts), never
 * freeform generation. Mirrors app/lib/passport/labels.ts's pattern. */
export function routeStepLabel(step: RouteStep, t: RouteStepTranslators): RouteStepLabel {
  const p = step.labelParams;
  const title = t.stepTypes(step.type);
  const done = step.status === "done";

  switch (step.type) {
    case "profile":
      return { title, detail: t.stepDetails(done ? "profileDone" : "profileTodo") };

    case "language_test": {
      if (done) {
        return {
          title,
          detail: p.targetScore
            ? t.stepDetails("languageTestMetTarget", { target: p.targetScore })
            : t.stepDetails("languageTestMet"),
        };
      }
      if (p.targetScore) {
        return {
          title,
          detail: t.stepDetails("languageTestTarget", { target: p.targetScore, current: p.currentScore ?? "—" }),
        };
      }
      return { title, detail: t.stepDetails("languageTestGeneric") };
    }

    case "university_search":
      return { title, detail: t.stepDetails("universitySearch") };

    case "shortlist": {
      const base = t.stepDetails("shortlistProgress", { count: p.count ?? 0, target: p.targetCount ?? 0 });
      if (p.safetyCount == null) return { title, detail: base };
      return {
        title,
        detail: `${base} · ${t.stepDetails("shortlistClassification", {
          safety: p.safetyCount,
          match: p.matchCount ?? 0,
          reach: p.reachCount ?? 0,
          unclassified: p.unclassifiedCount ?? 0,
        })}`,
      };
    }

    case "document": {
      if (done) return { title, detail: t.stepDetails("documentReady") };
      const documentLabel = p.documentType ? t.documentTypes(p.documentType) : title;
      return {
        title,
        detail: p.universityName
          ? t.stepDetails("documentPrepareFor", { document: documentLabel, university: p.universityName })
          : t.stepDetails("documentPrepare", { document: documentLabel }),
      };
    }

    case "portfolio":
      return { title, detail: t.stepDetails(done ? "portfolioReady" : "portfolioPrepare") };

    case "application":
      return {
        title,
        detail: p.universityName
          ? t.stepDetails("applicationSubmit", { university: p.universityName })
          : t.stepDetails("applicationProgress", { submitted: p.submittedCount ?? 0, total: p.totalCount ?? 0 }),
      };

    case "scholarship":
      return { title, detail: t.stepDetails("scholarship") };

    case "interview":
      return { title, detail: t.stepDetails("interview") };

    case "admission":
      return { title, detail: t.stepDetails(done ? "admissionAccepted" : "admissionWait") };

    case "payment":
      return { title, detail: t.stepDetails("payment") };

    case "visa":
      return { title, detail: t.stepDetails("visa") };

    case "housing":
      return { title, detail: t.stepDetails("housing") };

    case "travel":
      return { title, detail: t.stepDetails("travel") };

    case "arrival":
      return { title, detail: t.stepDetails("arrival") };
  }
}

/** Resolves one "Why this route?" bullet -- see app/lib/routes/reasons.ts
 * for how RouteReason values are computed from real numbers. `t` is the
 * "RouteReasons" namespace. */
export function routeReasonLabel(reason: RouteReason, t: (key: RouteReasonKind, values?: Values) => string): string {
  return t(reason.kind, reason.params);
}
