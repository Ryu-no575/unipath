import type { RouteStepType } from "@/app/lib/routes/types";
import { ROUTE_STEP_STYLES } from "@/app/lib/routes/step-style";
import CategoryIcon from "@/app/components/calendar/CategoryIcon";

const shared = {
  width: 16,
  height: 16,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** One glyph per RouteStepType. Reuses CategoryIcon for the step types that
 * map 1:1 onto a TaskType (see ROUTE_STEP_STYLES.taskIconType) so a "Visa"
 * step and a "Visa" task/calendar entry always look the same; every other
 * Route-only step type (profile, university_search, shortlist, portfolio,
 * admission, academic_improvement, backup_universities, tuition_comparison/
 * cost_of_living) gets a distinct glyph here so a route's own extra steps
 * are visually recognizable at a glance (task brief item 8), never the
 * fallback dot. */
export default function RouteStepIcon({ type, className }: { type: RouteStepType; className?: string }) {
  const style = ROUTE_STEP_STYLES[type];
  if (style.taskIconType) {
    return <CategoryIcon category={style.taskIconType} className={className} />;
  }

  const props = { ...shared, className };

  switch (type) {
    case "profile":
      return (
        <svg {...props}>
          <circle cx="10" cy="7" r="3" />
          <path d="M4 16.5c0-3 2.7-5 6-5s6 2 6 5" />
        </svg>
      );
    case "university_search":
      return (
        <svg {...props}>
          <circle cx="8.5" cy="8.5" r="5" />
          <path d="M16.5 16.5 12.7 12.7" />
        </svg>
      );
    case "shortlist":
      return (
        <svg {...props}>
          <path d="M4 5h12M4 10h12M4 15h7" />
          <circle cx="16.5" cy="15" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "portfolio":
      return (
        <svg {...props}>
          <rect x="3" y="6.5" width="14" height="9.5" rx="1.4" />
          <path d="M7.3 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2.4A1.5 1.5 0 0 1 12.7 5v1.5" />
        </svg>
      );
    case "admission":
      return (
        <svg {...props}>
          <path d="M3 8.5 10 4l7 4.5-7 4.5-7-4.5Z" />
          <path d="M6 10.3v3.4c0 1.1 1.8 2 4 2s4-.9 4-2v-3.4" />
        </svg>
      );
    case "academic_improvement":
      return (
        <svg {...props}>
          <path d="M2.5 7.5 10 4l7.5 3.5L10 11 2.5 7.5Z" />
          <path d="M5.5 9v3.3c0 1.3 2 2.4 4.5 2.4s4.5-1.1 4.5-2.4V9" />
        </svg>
      );
    case "backup_universities":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="11" height="9" rx="1.2" />
          <path d="M6 7.5h11a1.2 1.2 0 0 1 1.2 1.2V16" />
        </svg>
      );
    case "tuition_comparison":
    case "cost_of_living":
      return (
        <svg {...props}>
          <path d="M10 3v14M5 6h10M6.5 6 4 11a2.5 2.5 0 0 0 5 0L6.5 6ZM13.5 6 11 11a2.5 2.5 0 0 0 5 0L13.5 6Z" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="10" cy="10" r="4" />
        </svg>
      );
  }
}
