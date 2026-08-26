/**
 * Hand-written types mirroring supabase/migrations/*.sql. If you have the
 * Supabase CLI set up, prefer regenerating this with:
 *   supabase gen types typescript --project-id <ref> > app/lib/supabase/database.types.ts
 * Keep it in sync with the SQL by hand until then.
 *
 * `Relationships: []` on every table and the empty `Views`/`Functions` on
 * `public` aren't optional decoration — @supabase/supabase-js's `GenericTable`
 * / `GenericSchema` constraints require those exact keys to be present for
 * the typed client (`createClient<Database>()`) to type-check at all.
 */

export type ApplicationType = "bachelor" | "master" | "phd" | "exchange" | "transfer";
export type IntakeSeason = "spring" | "summer" | "fall" | "winter" | "flexible";
export type EnglishTestType =
  | "ielts"
  | "toefl"
  | "duolingo"
  | "cambridge"
  | "none"
  | "other";
export type PriorityType =
  | "tuition"
  | "academic_quality"
  | "ranking"
  | "employment"
  | "location"
  | "safety"
  | "international_community"
  | "cost_of_living"
  | "research"
  | "campus_life";
export type ApplicationStatus =
  | "considering"
  | "preparing"
  | "applied"
  | "interview"
  | "accepted"
  | "rejected"
  | "withdrawn";
export type TaskType =
  | "application"
  | "document"
  | "test"
  | "recommendation"
  | "scholarship"
  | "interview"
  | "payment"
  | "visa"
  | "housing"
  | "travel"
  | "enrollment"
  | "other";
export type CampusEnvironment = "urban" | "suburban" | "rural" | "no_preference";
export type ClassSizePreference = "small" | "medium" | "large" | "no_preference";
export type ClimatePreference = "warm" | "moderate" | "cold" | "no_preference";
export type SourcePageType =
  | "university"
  | "program"
  | "admissions"
  | "deadline"
  | "tuition"
  | "language_requirement"
  | "scholarship"
  | "visa"
  | "other";
export type ChangeEntityType = "university" | "program" | "admission_cycle";
export type ChangeType = "value_changed" | "added" | "removed";
export type ChangeImportance = "critical" | "important" | "minor";
export type ChangeReviewStatus =
  | "detected"
  | "pending_review"
  | "approved"
  | "applied"
  | "rejected";
export type SourceUrlStatus =
  | "valid"
  | "redirected"
  | "not_found"
  | "gone"
  | "blocked"
  | "timeout"
  | "invalid_domain"
  | "unknown";
export type StudentStatus = "applicant" | "admitted" | "current_student" | "alumni";
export type CommunityPostType =
  | "question"
  | "discussion"
  | "experience"
  | "housing"
  | "admissions"
  | "visa"
  | "portfolio"
  | "campus"
  | "city_life"
  | "other";
export type CommunityReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";
export type TestType = "ielts" | "toefl" | "cambridge" | "sat" | "act" | "gre" | "gmat" | "other";
export type DocumentType =
  | "cv"
  | "transcript"
  | "portfolio"
  | "motivation_letter"
  | "personal_statement"
  | "recommendation"
  | "english_certificate"
  | "degree_certificate"
  | "other";
export type DocumentStatus = "draft" | "ready" | "submitted" | "expired";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          nationality: string | null;
          residence_country: string | null;
          preferred_locale: string | null;
          application_type: ApplicationType | null;
          intake_year: number | null;
          intake_season: IntakeSeason | null;
          field_of_study: string | null;
          education_level: string | null;
          previous_institution: string | null;
          gpa_value: number | null;
          gpa_scale: number | null;
          english_test_type: EnglishTestType | null;
          english_test_score: string | null;
          max_tuition: number | null;
          tuition_currency: string | null;
          max_living_cost: number | null;
          living_cost_currency: string | null;
          timezone: string | null;
          onboarding_completed_at: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["profiles"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      community_profiles: {
        Row: {
          user_id: string;
          /** Community display name; falls back to a generated placeholder
           * (never the email) when null -- see app/lib/data/community.ts. */
          display_name: string | null;
          /** Self-reported relationship to a university (Applicant/Admitted/
           * Current Student/Alumni). Deliberately separate from
           * `student_status_verified` -- selecting a status must never imply
           * verification. */
          student_status: StudentStatus | null;
          student_status_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["community_profiles"]["Row"], "created_at" | "updated_at">> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_profiles"]["Insert"]>;
        Relationships: [];
      };
      profile_destination_preferences: {
        Row: {
          id: string;
          user_id: string;
          country_code: string;
          created_at: string;
        };
        Insert: Partial<Pick<Database["public"]["Tables"]["profile_destination_preferences"]["Row"], "id" | "created_at">> & {
          user_id: string;
          country_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_destination_preferences"]["Insert"]>;
        Relationships: [];
      };
      profile_priorities: {
        Row: {
          id: string;
          user_id: string;
          priority_type: PriorityType;
          weight: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Pick<Database["public"]["Tables"]["profile_priorities"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
          priority_type: PriorityType;
          weight: number;
        };
        Update: Partial<Database["public"]["Tables"]["profile_priorities"]["Insert"]>;
        Relationships: [];
      };
      universities: {
        Row: {
          id: string;
          ror_id: string | null;
          official_name: string;
          country_code: string | null;
          city: string | null;
          official_website: string | null;
          founded_year: number | null;
          latitude: number | null;
          longitude: number | null;
          /** "ror" | "manual" | null -- where this row's core facts came from. */
          data_source: string | null;
          /** The record page this data was synced from (e.g. https://ror.org/<id>). */
          source_url: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["universities"]["Row"], "id" | "created_at" | "updated_at">> & {
          official_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["universities"]["Insert"]>;
        Relationships: [];
      };
      user_custom_universities: {
        Row: {
          id: string;
          user_id: string;
          university_name: string;
          country_code: string | null;
          city: string | null;
          official_website: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["user_custom_universities"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
          university_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_custom_universities"]["Insert"]>;
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          university_id: string;
          official_name: string;
          degree_type: string | null;
          field: string | null;
          language: string | null;
          duration: string | null;
          official_url: string | null;
          /** When a curator last confirmed these fields against the official page. */
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["programs"]["Row"], "id" | "created_at" | "updated_at">> & {
          university_id: string;
          official_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["programs"]["Insert"]>;
        Relationships: [];
      };
      admission_cycles: {
        Row: {
          id: string;
          program_id: string;
          intake_year: number;
          intake_season: IntakeSeason;
          application_open_date: string | null;
          application_deadline: string | null;
          deadline_timezone: string | null;
          application_fee: number | null;
          application_fee_currency: string | null;
          tuition: number | null;
          tuition_currency: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["admission_cycles"]["Row"], "id" | "created_at" | "updated_at">> & {
          program_id: string;
          intake_year: number;
          intake_season: IntakeSeason;
        };
        Update: Partial<Database["public"]["Tables"]["admission_cycles"]["Insert"]>;
        Relationships: [];
      };
      admission_requirements: {
        Row: {
          id: string;
          admission_cycle_id: string;
          requirement_type: string;
          title: string;
          description: string | null;
          required: boolean;
          minimum_value: string | null;
          source_id: string | null;
          /** "high" | "medium" | "low" | null -- confidence in this value, given its source. */
          confidence: string | null;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["admission_requirements"]["Row"], "id" | "created_at">> & {
          admission_cycle_id: string;
          requirement_type: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["admission_requirements"]["Insert"]>;
        Relationships: [];
      };
      sources: {
        Row: {
          id: string;
          source_type: string;
          official_url: string | null;
          title: string | null;
          publisher: string | null;
          page_type: SourcePageType | null;
          retrieved_at: string | null;
          verified_at: string | null;
          last_checked_at: string | null;
          last_successful_check_at: string | null;
          valid_from: string | null;
          valid_until: string | null;
          university_id: string | null;
          program_id: string | null;
          admission_cycle_id: string | null;
          /** Result of the most recent server-side reachability/domain check
           * (see app/lib/live-data/validateSource.ts). Only "valid" and
           * "redirected" count as Verified -- see AGENTS.md task notes on
           * Source Validation. Defaults to "unknown" until first checked. */
          url_status: SourceUrlStatus;
          http_status: number | null;
          /** Final URL after following redirects, when different from
           * official_url. Preferred over official_url whenever present and
           * url_status is "valid" or "redirected". */
          resolved_url: string | null;
          last_validated_at: string | null;
          validation_error: string | null;
          consecutive_failures: number;
          /** Points at a different `sources` row that supersedes this one
           * (e.g. a curator repointed a permanently-moved page to a new
           * source row instead of editing this one in place). */
          replaced_by_source_id: string | null;
          next_check_due_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["sources"]["Row"], "id" | "created_at" | "updated_at">> & {
          source_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
        Relationships: [];
      };
      source_snapshots: {
        Row: {
          id: string;
          source_id: string;
          content_hash: string;
          extracted_data: Record<string, unknown>;
          retrieved_at: string;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["source_snapshots"]["Row"], "id" | "created_at">> & {
          source_id: string;
          content_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["source_snapshots"]["Insert"]>;
        Relationships: [];
      };
      change_events: {
        Row: {
          id: string;
          source_id: string | null;
          entity_type: ChangeEntityType;
          entity_id: string;
          field_name: string;
          old_value: string | null;
          new_value: string | null;
          change_type: ChangeType;
          importance: ChangeImportance;
          detected_at: string;
          review_status: ChangeReviewStatus;
          /** True only for rows written by a dev seed/simulate tool, never a
           * real checkSource() detection -- see 20260826240000_real_university_data_v1.sql. */
          is_simulated: boolean;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["change_events"]["Row"], "id" | "created_at">> & {
          entity_type: ChangeEntityType;
          entity_id: string;
          field_name: string;
          importance: ChangeImportance;
        };
        Update: Partial<Database["public"]["Tables"]["change_events"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          change_event_id: string | null;
          community_post_id: string | null;
          community_comment_id: string | null;
          title: string;
          message: string;
          read: boolean;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at">> & {
          user_id: string;
          title: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      watch_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          university_id: string | null;
          program_id: string | null;
          admission_cycle_id: string | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["watch_subscriptions"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["watch_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          user_id: string;
          program_id: string | null;
          admission_cycle_id: string | null;
          custom_university_id: string | null;
          custom_program_name: string | null;
          custom_degree_type: string | null;
          custom_field: string | null;
          custom_intake_year: number | null;
          custom_intake_season: IntakeSeason | null;
          custom_application_deadline: string | null;
          custom_deadline_timezone: string | null;
          status: ApplicationStatus;
          progress: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["applications"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          application_id: string | null;
          title: string;
          description: string | null;
          task_type: TaskType;
          due_at: string | null;
          timezone: string;
          completed: boolean;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["tasks"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      match_preferences: {
        Row: {
          id: string;
          user_id: string;
          campus_environment: CampusEnvironment;
          class_size_preference: ClassSizePreference;
          climate_preference: ClimatePreference;
          work_while_studying_importance: number;
          scholarship_need: boolean;
          completed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["match_preferences"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["match_preferences"]["Insert"]>;
        Relationships: [];
      };
      community_posts: {
        Row: {
          id: string;
          user_id: string;
          university_id: string;
          program_id: string | null;
          admission_cycle_id: string | null;
          post_type: CommunityPostType;
          title: string | null;
          body: string;
          language_code: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["community_posts"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
          university_id: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_posts"]["Insert"]>;
        Relationships: [];
      };
      community_comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          parent_comment_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["community_comments"]["Row"], "id" | "created_at" | "updated_at">> & {
          post_id: string;
          user_id: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_comments"]["Insert"]>;
        Relationships: [];
      };
      community_post_likes: {
        Row: {
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: Partial<Pick<Database["public"]["Tables"]["community_post_likes"]["Row"], "created_at">> & {
          user_id: string;
          post_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_post_likes"]["Insert"]>;
        Relationships: [];
      };
      community_reports: {
        Row: {
          id: string;
          reporter_user_id: string;
          post_id: string | null;
          comment_id: string | null;
          reason: string;
          details: string | null;
          status: CommunityReportStatus;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["community_reports"]["Row"], "id" | "created_at">> & {
          reporter_user_id: string;
          reason: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_reports"]["Insert"]>;
        Relationships: [];
      };
      user_blocks: {
        Row: {
          blocker_user_id: string;
          blocked_user_id: string;
          created_at: string;
        };
        Insert: Partial<Pick<Database["public"]["Tables"]["user_blocks"]["Row"], "created_at">> & {
          blocker_user_id: string;
          blocked_user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_blocks"]["Insert"]>;
        Relationships: [];
      };
      education_history: {
        Row: {
          id: string;
          user_id: string;
          institution_name: string;
          country_code: string | null;
          education_level: string | null;
          field_of_study: string | null;
          start_date: string | null;
          end_date: string | null;
          graduation_date: string | null;
          gpa_value: number | null;
          gpa_scale: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["education_history"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
          institution_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["education_history"]["Insert"]>;
        Relationships: [];
      };
      test_scores: {
        Row: {
          id: string;
          user_id: string;
          test_type: TestType;
          overall_score: string | null;
          component_scores: Record<string, unknown> | null;
          test_date: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["test_scores"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
          test_type: TestType;
        };
        Update: Partial<Database["public"]["Tables"]["test_scores"]["Insert"]>;
        Relationships: [];
      };
      application_documents: {
        Row: {
          id: string;
          user_id: string;
          document_type: DocumentType;
          title: string;
          storage_path: string | null;
          status: DocumentStatus;
          language_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["application_documents"]["Row"], "id" | "created_at" | "updated_at">> & {
          user_id: string;
          document_type: DocumentType;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["application_documents"]["Insert"]>;
        Relationships: [];
      };
      application_document_versions: {
        Row: {
          id: string;
          document_id: string;
          storage_path: string;
          file_name: string;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: Partial<Omit<Database["public"]["Tables"]["application_document_versions"]["Row"], "id" | "created_at">> & {
          document_id: string;
          storage_path: string;
          file_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["application_document_versions"]["Insert"]>;
        Relationships: [];
      };
      application_document_links: {
        Row: {
          id: string;
          application_id: string;
          document_id: string;
          created_at: string;
        };
        Insert: Partial<Pick<Database["public"]["Tables"]["application_document_links"]["Row"], "id" | "created_at">> & {
          application_id: string;
          document_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["application_document_links"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      application_type: ApplicationType;
      intake_season: IntakeSeason;
      english_test_type: EnglishTestType;
      priority_type: PriorityType;
      application_status: ApplicationStatus;
      task_type: TaskType;
      campus_environment: CampusEnvironment;
      class_size_preference: ClassSizePreference;
      climate_preference: ClimatePreference;
      student_status: StudentStatus;
      community_post_type: CommunityPostType;
      community_report_status: CommunityReportStatus;
      test_type: TestType;
      document_type: DocumentType;
      document_status: DocumentStatus;
    };
  };
}
