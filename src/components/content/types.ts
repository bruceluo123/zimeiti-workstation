export type DraftStatus = "draft" | "needs_review" | "approved" | "scheduled" | "publishing" | "published" | "failed" | "handoff_pending" | "reported_published" | "skipped";

export interface MirrorDraft {
  id: string;
  source_id: string;
  revision_id: string;
  body: string;
  status: DraftStatus;
  target_account_id: string;
  published_url: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  publish_attempts: number;
  last_error: string | null;
  ai_generated: boolean;
  content_sources: { source_url: string | null; origin_platform: string } | null;
}
