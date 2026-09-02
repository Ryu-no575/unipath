import type { Database } from "@/app/lib/supabase/database.types";
import {
  classifyRequirement,
  QUALIFICATION_ACCEPTANCE_PATTERNS,
  type ApplicationReadiness,
} from "@/app/lib/passport/readiness";
import { parseNumericMinimum } from "@/app/lib/routes/eligibility";
import type { EligibilityRequirementItem, ProgramEligibility, ProgramEligibilityTier, UserCredentials } from "./types";

type AdmissionRequirementRow = Database["public"]["Tables"]["admission_requirements"]["Row"];

/** Extracts a GPA minimum from free text, preferring an explicit scale
 * ("3.0/4.0") over a bare number. Returns null (never a guess) when nothing
 * numeric is present. */
function extractGpaTarget(minimumValue: string | null): { value: number; scale: number | null } | null {
  if (!minimumValue) return null;
  const scaledMatch = minimumValue.match(/(\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)/);
  if (scaledMatch) {
    return { value: Number(scaledMatch[1]), scale: Number(scaledMatch[3]) };
  }
  const parsed = parseNumericMinimum(minimumValue);
  return parsed == null ? null : { value: parsed, scale: null };
}

/** GPA comparison is only ever made when the scale can be trusted: either
 * the requirement states its own scale and it matches the user's, or the
 * requirement has no stated scale and the user's own scale is the
 * conventional 4.0. Any other combination (mismatched scales, no scale
 * information at all) stays "unknown" rather than risk a wrong comparison --
 * never normalize/convert a GPA across scales by guessing. */
function compareGpa(target: { value: number; scale: number | null }, credentials: UserCredentials): "met" | "missing" | "unknown" {
  if (credentials.gpaValue == null) return "unknown";
  if (target.scale != null) {
    if (credentials.gpaScale == null || Math.abs(target.scale - credentials.gpaScale) > 0.001) return "unknown";
  } else if (credentials.gpaScale != null && Math.abs(credentials.gpaScale - 4) > 0.001) {
    return "unknown";
  }
  return credentials.gpaValue >= target.value ? "met" : "missing";
}

function acceptedQualificationTypes(req: AdmissionRequirementRow): string[] {
  const text = `${req.requirement_type} ${req.title} ${req.description ?? ""}`;
  for (const { pattern, accepts } of QUALIFICATION_ACCEPTANCE_PATTERNS) {
    if (pattern.test(text)) return accepts;
  }
  return [];
}

/** Classifies one program/admission-cycle's real, required admission
 * requirements against the user's actual, self-reported credentials (task
 * item 4). `readiness` must already be computed for the SAME requirements
 * via computeApplicationReadiness (app/lib/passport/readiness.ts) -- its
 * document/test ready-or-not signals are reused as-is here rather than
 * re-derived, so the two engines can never disagree about whether a document
 * or test requirement is satisfied. English is the one exception: this
 * engine compares the user's actual numeric score against the published
 * minimum (mirroring app/lib/routes/eligibility.ts:assessEligibility)
 * instead of readiness's boolean "has some English evidence" signal, because
 * "eligible" needs to know the score clears the bar, not just that a score
 * exists. */
export function computeProgramEligibility(params: {
  requirements: AdmissionRequirementRow[];
  readiness: ApplicationReadiness;
  credentials: UserCredentials;
}): ProgramEligibility {
  const { requirements, readiness, credentials } = params;
  const required = requirements.filter((r) => r.required);
  const readinessByRequirementId = new Map(readiness.items.map((i) => [i.requirementId, i]));

  const items: EligibilityRequirementItem[] = required.map((req): EligibilityRequirementItem => {
    const classified = classifyRequirement({
      requirementType: req.requirement_type,
      title: req.title,
      description: req.description,
    });

    if (classified.category === "test" && classified.testHint === "english") {
      const target = parseNumericMinimum(req.minimum_value);
      if (target == null || credentials.englishScore == null) {
        return { requirementId: req.id, title: req.title, status: "unknown" };
      }
      return { requirementId: req.id, title: req.title, status: credentials.englishScore >= target ? "met" : "missing" };
    }

    if (classified.category === "document" || classified.category === "test") {
      const readinessItem = readinessByRequirementId.get(req.id);
      if (!readinessItem || readinessItem.status === "unknown") {
        return { requirementId: req.id, title: req.title, status: "unknown" };
      }
      return { requirementId: req.id, title: req.title, status: readinessItem.status === "ready" ? "met" : "missing" };
    }

    if (classified.category === "academic" && classified.academicHint === "gpa") {
      const target = extractGpaTarget(req.minimum_value);
      if (!target) return { requirementId: req.id, title: req.title, status: "unknown" };
      return { requirementId: req.id, title: req.title, status: compareGpa(target, credentials) };
    }

    if (classified.category === "academic" && classified.academicHint === "qualification_type") {
      if (!credentials.qualificationType) return { requirementId: req.id, title: req.title, status: "unknown" };
      const accepted = acceptedQualificationTypes(req);
      return {
        requirementId: req.id,
        title: req.title,
        status: accepted.includes(credentials.qualificationType) ? "met" : "missing",
      };
    }

    return { requirementId: req.id, title: req.title, status: "unknown" };
  });

  const trackable = items.filter((i) => i.status !== "unknown");
  const met = trackable.filter((i) => i.status === "met");
  const missing = trackable.filter((i) => i.status === "missing");

  // Task item 4's own worked example (Politecnico di Torino: IELTS + secondary
  // qualification met, only TIL-A missing -> ALMOST ELIGIBLE) is exactly
  // "everything trackable met except one" -- this is that rule.
  let tier: ProgramEligibilityTier;
  if (trackable.length === 0) tier = "unknown";
  else if (missing.length === 0) tier = "eligible_now";
  else if (missing.length === 1) tier = "almost_eligible";
  else tier = "not_currently_eligible";

  return { tier, items, metCount: met.length, missingCount: missing.length, trackableCount: trackable.length };
}
