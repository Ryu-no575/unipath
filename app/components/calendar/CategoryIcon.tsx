import type { TaskType } from "@/app/lib/supabase/database.types";

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

/** One visually distinct glyph per task_type — paired with color + a text
 * label everywhere it's used, never the only way a category is conveyed. */
export default function CategoryIcon({
  category,
  className,
}: {
  category: TaskType;
  className?: string;
}) {
  const props = { ...shared, className };

  switch (category) {
    case "application":
      return (
        <svg {...props}>
          <rect x="4" y="3" width="12" height="14" rx="1.5" />
          <path d="M7 8h6M7 11h6M7 14h3.5" />
        </svg>
      );
    case "document":
      return (
        <svg {...props}>
          <path d="M6 2.5h6l3 3V17a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
          <path d="M12 2.5V6h3" />
        </svg>
      );
    case "test":
      return (
        <svg {...props}>
          <path d="M8 2.5h4" />
          <path d="M9 2.5v4.2L4.8 14a1.8 1.8 0 0 0 1.6 2.7h7.2a1.8 1.8 0 0 0 1.6-2.7L11 6.7V2.5" />
          <path d="M6.2 12h7.6" />
        </svg>
      );
    case "recommendation":
      return (
        <svg {...props}>
          <circle cx="7.2" cy="6.5" r="2.2" />
          <circle cx="13.2" cy="8" r="1.8" />
          <path d="M2.8 16.5c0-2.6 2-4.2 4.4-4.2s4.4 1.6 4.4 4.2" />
          <path d="M12.6 12.7c1.9.2 3.2 1.6 3.2 3.8" />
        </svg>
      );
    case "scholarship":
      return (
        <svg {...props}>
          <path d="M10 2.8 12 7.4l5 .6-3.7 3.4.9 4.9L10 13.8l-4.2 2.5.9-4.9L3 8l5-.6 2-4.6Z" />
        </svg>
      );
    case "interview":
      return (
        <svg {...props}>
          <path d="M3 4.5h14v9H8.5L5 16.5v-3H3v-9Z" />
          <path d="M6.5 8h7M6.5 10.5h4.5" />
        </svg>
      );
    case "payment":
      return (
        <svg {...props}>
          <rect x="2.5" y="5" width="15" height="10" rx="1.5" />
          <path d="M2.5 8.5h15" />
          <path d="M5.5 12h3" />
        </svg>
      );
    case "visa":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="14" height="14" rx="2" />
          <circle cx="7.8" cy="8" r="1.8" />
          <path d="M4.8 14c.4-1.8 1.7-2.6 3-2.6s2.6.8 3 2.6" />
          <path d="M12.5 7h3.2M12.5 9.8h3.2" />
        </svg>
      );
    case "housing":
      return (
        <svg {...props}>
          <path d="M3 10 10 3.5 17 10" />
          <path d="M5 8.7V16h10V8.7" />
          <path d="M8.3 16v-4h3.4v4" />
        </svg>
      );
    case "travel":
      return (
        <svg {...props}>
          <path d="M10.8 2.7c.7 0 1.2.5 1.2 1.2v4.4l4.6 2.9v1.6l-4.6-1.4v3.2l1.6 1.2v1.3L10 15.9l-3.6 1.2v-1.3l1.6-1.2v-3.2l-4.6 1.4v-1.6l4.6-2.9V3.9c0-.7.5-1.2 1-1.2Z" />
        </svg>
      );
    case "enrollment":
      return (
        <svg {...props}>
          <path d="M10 4 2.5 7.5 10 11l7.5-3.5L10 4Z" />
          <path d="M5.5 9.3V13c0 1.2 2 2.3 4.5 2.3s4.5-1.1 4.5-2.3V9.3" />
          <path d="M17.5 7.5v4.2" />
        </svg>
      );
    case "other":
    default:
      return (
        <svg {...props}>
          <circle cx="5.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="10" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
