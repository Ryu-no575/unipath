import { useTranslations } from "next-intl";
import Badge, { type BadgeTone } from "./Badge";

/**
 * The one shared status vocabulary for the whole app (AGENTS.md section 14).
 * Domain-specific pipelines (application stages, review states, etc.) keep
 * their own enums and labels -- this is only for the cross-cutting concepts
 * that used to be worded differently on every screen (e.g. "unverified" vs
 * "Unknown" vs "Limited data").
 */
export type StatusKind =
  | "verified"
  | "updated"
  | "ready"
  | "missing"
  | "dueSoon"
  | "completed"
  | "needsAttention"
  | "unknown";

const TONE_BY_KIND: Record<StatusKind, BadgeTone> = {
  verified: "success",
  updated: "info",
  ready: "success",
  missing: "danger",
  dueSoon: "warning",
  completed: "neutral",
  needsAttention: "warning",
  unknown: "neutral",
};

export function Status({
  kind,
  className = "",
}: {
  kind: StatusKind;
  className?: string;
}) {
  const t = useTranslations("Status");
  return (
    <Badge tone={TONE_BY_KIND[kind]} className={className}>
      {t(kind)}
    </Badge>
  );
}

/** "94% Match" -- the one match-score pill used everywhere a score is shown. */
export function MatchStatus({
  percent,
  className = "",
}: {
  percent: number;
  className?: string;
}) {
  const t = useTranslations("Status");
  const tone: BadgeTone = percent >= 85 ? "success" : percent >= 65 ? "info" : "neutral";
  return (
    <Badge tone={tone} className={`text-sm font-semibold ${className}`}>
      {t("match", { percent })}
    </Badge>
  );
}

export default Status;
