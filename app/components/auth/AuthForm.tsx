"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { AuthFormState } from "@/app/lib/actions/auth";

const inputClasses =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-sm font-medium text-zinc-700";

type Action = (
  state: AuthFormState | undefined,
  formData: FormData,
) => Promise<AuthFormState>;

export default function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: Action;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const t = useTranslations("Auth");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t(state.error)}
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={labelClasses}>{t("emailLabel")}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className={inputClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClasses}>{t("passwordLabel")}</span>
        <input
          type="password"
          name="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? 8 : undefined}
          required
          className={inputClasses}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex items-center justify-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {pending ? t("saving") : t(mode === "login" ? "loginSubmit" : "signupSubmit")}
      </button>
    </form>
  );
}
