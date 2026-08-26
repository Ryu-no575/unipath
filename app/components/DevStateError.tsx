/**
 * Shown when `getUserState()` couldn't read the profile (DB/network error),
 * as opposed to the profile simply not existing yet. Never redirect on this
 * state — see app/lib/supabase/user-state.ts — since redirecting into
 * onboarding or dashboard on a transient read failure is what causes the
 * two to bounce back and forth forever.
 */
export default function DevStateError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <h1 className="text-lg font-semibold text-red-800">Couldn&apos;t load your profile</h1>
      <p className="mt-2 text-sm text-red-700">
        This is a database error, not a missing profile — reloading may fix it. Showing details
        because this is a development build.
      </p>
      {process.env.NODE_ENV !== "production" && (
        <pre className="mt-4 overflow-x-auto rounded-md bg-red-100 p-3 text-xs text-red-900">
          {message}
        </pre>
      )}
    </div>
  );
}
