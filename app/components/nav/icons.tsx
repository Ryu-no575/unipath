const COMMON = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function HomeIcon() {
  return (
    <svg {...COMMON}>
      <path d="M3 9.5 10 3l7 6.5" />
      <path d="M5 8.5V17h10V8.5" />
    </svg>
  );
}

export function ExploreIcon() {
  return (
    <svg {...COMMON}>
      <circle cx="9.5" cy="9.5" r="6" />
      <path d="M14 14l3.5 3.5" />
    </svg>
  );
}

export function PlanIcon() {
  return (
    <svg {...COMMON}>
      <circle cx="5" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="5" cy="15" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <path d="M5 6.6V13.4" />
      <path d="M6.3 5.9l7.4 3.3" />
      <path d="M6.3 14.1l7.4-3.3" />
    </svg>
  );
}

export function CommunityIcon() {
  return (
    <svg {...COMMON}>
      <circle cx="7.5" cy="7" r="2.5" />
      <path d="M2.5 16c0-2.5 2.2-4 5-4s5 1.5 5 4" />
      <circle cx="14.5" cy="8" r="2" />
      <path d="M13 12.2c1.9.2 3.5 1.5 3.5 3.8" />
    </svg>
  );
}

export function ProfileIcon() {
  return (
    <svg {...COMMON}>
      <circle cx="10" cy="6.5" r="3.2" />
      <path d="M4 17c0-3 2.7-5 6-5s6 2 6 5" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg {...COMMON}>
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}
