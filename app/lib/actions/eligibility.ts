"use server";

import { createClient } from "@/app/lib/supabase/server";
import {
  getApplicationDocuments,
  getDocumentLinksForUser,
  getTestScores,
} from "@/app/lib/data/passport";
import { getCatalogEligibilityCandidates, profileToUserCredentials } from "@/app/lib/data/eligibility";
import { simulateCredentialChange, type CredentialOverride, type UnlockSimulationResult } from "@/app/lib/eligibility/unlockSimulator";

export interface SimulateUnlockResult {
  error?: string;
  result?: UnlockSimulationResult;
}

/** Task item 5's Unlock Simulator: "What would unlock more options?" Runs
 * server-side (never in the client bundle) since it needs the user's real
 * documents/test scores/profile plus the whole real program catalog. Only
 * ever counts programs with real verified requirement data -- see
 * app/lib/eligibility/unlockSimulator.ts's own honesty guarantees. */
export async function simulateUnlockAction(override: CredentialOverride): Promise<SimulateUnlockResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (!profile) return { error: "Profile not found" };

  const [documents, testScores, allLinks, candidates] = await Promise.all([
    getApplicationDocuments(supabase, user.id),
    getTestScores(supabase, user.id),
    getDocumentLinksForUser(supabase),
    getCatalogEligibilityCandidates(supabase),
  ]);

  const result = simulateCredentialChange(candidates, {
    documents,
    testScores,
    linkedDocumentIds: new Set(allLinks.map((l) => l.documentId)),
    englishProfile: { english_test_type: profile.english_test_type, english_test_score: profile.english_test_score },
    credentials: profileToUserCredentials(profile),
  }, override);

  return { result };
}
