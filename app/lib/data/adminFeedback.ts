import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FeedbackCategory, FeedbackStatus } from "@/app/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface AdminFeedbackRow {
  id: string;
  category: FeedbackCategory;
  message: string;
  pagePath: string | null;
  status: FeedbackStatus;
  createdAt: string;
  fromGuest: boolean;
}

/** /admin/feedback (AGENTS.md section 18/20) -- newest first. */
export async function listFeedback(supabase: Client): Promise<AdminFeedbackRow[]> {
  const { data } = await supabase.from("user_feedback").select("*").order("created_at", { ascending: false }).limit(200);
  if (!data || data.length === 0) return [];

  return data.map((row) => ({
    id: row.id,
    category: row.category,
    message: row.message,
    pagePath: row.page_path,
    status: row.status,
    createdAt: row.created_at,
    fromGuest: !row.user_id,
  }));
}
