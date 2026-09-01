import type { ProfileFormValues } from "@/app/lib/profile-types";

/**
 * Carries a guest's Match Quiz answers across the signup wall (task brief
 * section 4: "don't make them redo the quiz"). sessionStorage (not
 * localStorage) is deliberate -- it's cleared when the tab closes, so an
 * abandoned guest session never lingers, and it's read exactly once, right
 * after signup, by OnboardingWizard. Holds only the same study-goal/
 * destination/budget fields the Guest Match Quiz itself asks for -- never
 * anything the quiz didn't collect, and nothing tied to an identity.
 */
const STORAGE_KEY = "unipath:guestMatchProfile";

export function writeGuestProfileToSession(values: ProfileFormValues) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // Private browsing / storage disabled -- the guest quiz still works via
    // URL params (see guestQuery.ts), this only loses the onboarding prefill.
  }
}

/** Reads and immediately clears the stored answers -- they're only ever
 * meant to prefill onboarding once, right after signup. */
export function consumeGuestProfileFromSession(): Partial<ProfileFormValues> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Partial<ProfileFormValues>) : null;
  } catch {
    return null;
  }
}
