"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button, { type ButtonProps } from "@/app/components/ui/Button";

export interface AdminActionResult {
  error?: string;
}

/**
 * Generic client wrapper for a single admin Server Action (Approve/Reject/
 * Verify/Resolve/...): every admin mutation in this app re-checks
 * `requireAdmin()` itself server-side (see app/lib/supabase/roles.ts), so
 * this component adds no authorization of its own -- it only handles the
 * pending state, error display, and refreshing the page's data afterward.
 */
export default function AdminActionButton({
  action,
  label,
  pendingLabel,
  variant = "secondary",
}: {
  action: () => Promise<AdminActionResult>;
  label: string;
  pendingLabel?: string;
  variant?: ButtonProps extends { variant?: infer V } ? V : never;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await action();
            if (result.error) {
              setError(result.error);
            } else {
              setError(null);
              router.refresh();
            }
          })
        }
      >
        {isPending ? (pendingLabel ?? label) : label}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
