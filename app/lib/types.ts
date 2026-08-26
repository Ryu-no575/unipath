export type ApplicationStatus =
  | "Considering"
  | "Preparing"
  | "Applied"
  | "Accepted"
  | "Rejected";

export type PortfolioRequirement = "Required" | "Not Required" | "Optional";

export interface University {
  id: string;
  /** Official name — a proper noun, never machine-translated. */
  name: string;
  /** Future: locale-specific display name shown alongside the official name. */
  displayName?: string;
  country: string;
  program: string;
  degree?: string;
  intakeYear?: number;
  deadline: string;
  applicationUrl?: string;
  status: ApplicationStatus;
  progress: number;
  englishRequirement?: string;
  entranceExam?: string;
  tuition?: string;
  applicationFee?: string;
  portfolioRequirement?: PortfolioRequirement;
  notes?: string;
  sourceUrl?: string;
  lastVerifiedDate?: string;
}

export const CHECKLIST_ITEMS = [
  "Passport",
  "Transcript",
  "English Certificate",
  "Motivation Letter",
  "Recommendation Letter",
  "Portfolio",
  "Entrance Exam",
  "Application Submitted",
  "Application Fee Paid",
] as const;

export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];
