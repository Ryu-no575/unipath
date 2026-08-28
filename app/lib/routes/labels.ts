import type { DocumentType } from "@/app/lib/supabase/database.types";
import type {
  RouteDiffEntry,
  RouteDiffKind,
  RouteReason,
  RouteReasonKind,
  RouteStep,
  RouteStepType,
  RouteSubStep,
  RouteSubStepKey,
} from "./types";

/** Every key routeStepLabel below can request from the "RouteStepDetails"
 * message namespace -- kept as an explicit union (rather than `string`) so
 * next-intl's generated message types (see global.d.ts) catch a typo or a
 * removed key at compile time instead of silently rendering the raw key. */
export type RouteStepDetailKey =
  | "profileDone"
  | "profileTodo"
  | "academicImprovement"
  | "languageTestMet"
  | "languageTestMetTarget"
  | "languageTestGeneric"
  | "languageTestTarget"
  | "universitySearch"
  | "backupUniversities"
  | "backupUniversitiesReady"
  | "shortlistProgress"
  | "shortlistClassification"
  | "documentReady"
  | "documentPrepare"
  | "documentPrepareFor"
  | "documentVerification"
  | "portfolioReady"
  | "portfolioPrepare"
  | "portfolioPrepareIterations"
  | "entranceExamReady"
  | "entranceExamPrepare"
  | "scholarship"
  | "scholarshipResearch"
  | "tuitionComparison"
  | "costOfLiving"
  | "affordableHousing"
  | "flightMonitoring"
  | "applicationSubmit"
  | "applicationProgress"
  | "earlySubmission"
  | "interview"
  | "admissionWait"
  | "admissionAccepted"
  | "payment"
  | "visa"
  | "backupVisa"
  | "housing"
  | "multipleHousing"
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

    case "academic_improvement":
      return { title, detail: t.stepDetails("academicImprovement", { count: p.reachCount ?? 0 }) };

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

    case "backup_universities":
      return {
        title,
        detail: done
          ? t.stepDetails("backupUniversitiesReady")
          : t.stepDetails("backupUniversities", { count: p.count ?? 0, target: p.targetCount ?? 0 }),
      };

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

    case "document_verification":
      return { title, detail: t.stepDetails("documentVerification") };

    case "portfolio":
      if (done) return { title, detail: t.stepDetails("portfolioReady") };
      return {
        title,
        detail:
          (p.count ?? 1) >= 2
            ? t.stepDetails("portfolioPrepareIterations", { count: p.count ?? 1 })
            : t.stepDetails("portfolioPrepare"),
      };

    case "entrance_exam":
      return { title, detail: t.stepDetails(done ? "entranceExamReady" : "entranceExamPrepare") };

    case "scholarship":
      return { title, detail: t.stepDetails("scholarship") };
    case "scholarship_research":
      return { title, detail: t.stepDetails("scholarshipResearch") };
    case "tuition_comparison":
      return { title, detail: t.stepDetails("tuitionComparison") };
    case "cost_of_living":
      return { title, detail: t.stepDetails("costOfLiving") };
    case "affordable_housing":
      return { title, detail: t.stepDetails("affordableHousing") };
    case "flight_monitoring":
      return { title, detail: t.stepDetails("flightMonitoring") };

    case "application":
      return {
        title,
        detail: p.universityName
          ? t.stepDetails("applicationSubmit", { university: p.universityName })
          : t.stepDetails("applicationProgress", { submitted: p.submittedCount ?? 0, total: p.totalCount ?? 0 }),
      };

    case "early_submission":
      return { title, detail: t.stepDetails("earlySubmission") };

    case "interview":
      return { title, detail: t.stepDetails("interview") };

    case "admission":
      return { title, detail: t.stepDetails(done ? "admissionAccepted" : "admissionWait") };

    case "payment":
      return { title, detail: t.stepDetails("payment") };

    case "visa":
      return { title, detail: t.stepDetails("visa") };
    case "backup_visa":
      return { title, detail: t.stepDetails("backupVisa") };

    case "housing":
      return { title, detail: t.stepDetails("housing") };
    case "multiple_housing":
      return { title, detail: t.stepDetails("multipleHousing") };

    case "travel":
      return { title, detail: t.stepDetails("travel") };

    case "arrival":
      return { title, detail: t.stepDetails("arrival") };
  }
}

/** "RouteSubStepOptions" namespace -- one short label per RouteSubStepKey.
 * Progressive Disclosure (task brief item 7): these only render once a
 * step's expand affordance is opened. */
export function routeSubStepLabel(
  subStep: RouteSubStep,
  t: (key: RouteSubStepKey, values?: Values) => string,
): string {
  return t(subStep.key, subStep.labelParams.iteration != null ? { iteration: subStep.labelParams.iteration } : undefined);
}

/** Resolves one "Why this route?" bullet -- see app/lib/routes/reasons.ts
 * for how RouteReason values are computed from real numbers. `t` is the
 * "RouteReasons" namespace. */
export function routeReasonLabel(reason: RouteReason, t: (key: RouteReasonKind, values?: Values) => string): string {
  return t(reason.kind, reason.params);
}

/** Resolves one "Switching to X route will: ..." bullet -- see
 * app/lib/routes/routeDiff.ts. `t` is the "RouteDiffs" namespace;
 * `stepTypes` is "RouteStepTypeOptions", used when a diff names a step. */
export function routeDiffLabel(
  diff: RouteDiffEntry,
  t: (key: RouteDiffKind, values?: Values) => string,
  stepTypes: (key: RouteStepType) => string,
): string {
  const values: Values = { ...diff.params };
  if (diff.stepType) values.step = stepTypes(diff.stepType);
  return t(diff.kind, values);
}
