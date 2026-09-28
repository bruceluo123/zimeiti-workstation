import { createAutomationSupabase } from "@/lib/supabase/automation";
import { decryptWeiboSecret, encryptWeiboSecret } from "@/lib/weibo/credential";
import { publishWeiboText, refreshWeiboTokens, WeiboCliError } from "@/lib/weibo/client";

interface ClaimedDraft {
  draft_id: string;
  workspace_id: string;
  body: string;
  ai_generated: boolean;
  target_account_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  access_expires_at: string;
  refresh_expires_at: string;
}

export async function publishDueWeiboDrafts(secret: string, limit = 5) {
  const supabase = createAutomationSupabase();
  const results: Array<{ id: string; status: string }> = [];
  for (let index = 0; index < limit; index++) {
    const { data, error } = await supabase.rpc("automation_claim_due_weibo", { input_secret: secret });
    const draft = (Array.isArray(data) ? data[0] : null) as ClaimedDraft | null;
    if (error) throw new Error("Unable to claim publish queue");
    if (!draft) break;
    let acceptedByWeibo = false;
    try {
      let accessToken = decryptWeiboSecret(draft.access_token_ciphertext, "access");
      if (new Date(draft.access_expires_at).getTime() < Date.now() + 5 * 60_000) {
        if (new Date(draft.refresh_expires_at).getTime() <= Date.now()) throw new WeiboCliError(401, "REFRESH_EXPIRED", "微博长期授权已过期，请重新连接");
        const refreshToken = decryptWeiboSecret(draft.refresh_token_ciphertext, "refresh");
        const tokens = await refreshWeiboTokens(refreshToken);
        accessToken = tokens.accessToken;
        const now = Date.now();
        const { error: tokenError } = await supabase.rpc("automation_update_weibo_tokens", {
          input_secret: secret,
          input_workspace_id: draft.workspace_id,
          input_access_ciphertext: encryptWeiboSecret(tokens.accessToken, "access"),
          input_refresh_ciphertext: encryptWeiboSecret(tokens.refreshToken, "refresh"),
          input_access_expires_at: new Date(now + tokens.expiresIn * 1000).toISOString(),
          input_refresh_expires_at: new Date(now + tokens.refreshExpiresIn * 1000).toISOString(),
        });
        if (tokenError) throw new Error("微博凭据续期后保存失败，已暂停发布");
      }
      const published = await publishWeiboText(accessToken, draft.body, draft.ai_generated);
      acceptedByWeibo = true;
      const publishedUrl = `https://weibo.com/${draft.target_account_id}/${published.urlSlug}`;
      const { error: finishError } = await supabase.rpc("automation_finish_weibo_publish", {
        input_secret: secret,
        input_draft_id: draft.draft_id,
        input_success: true,
        input_post_id: published.id,
        input_published_url: publishedUrl,
        input_error: null,
        input_retryable: false,
      });
      if (finishError) throw new Error("微博已发布，但保存发布结果失败；请核对微博后再处理该条");
      results.push({ id: draft.draft_id, status: "published" });
    } catch (cause) {
      if (acceptedByWeibo) throw cause;
      const apiError = cause instanceof WeiboCliError ? cause : null;
      const retryable = Boolean(apiError && (apiError.status === 429 || apiError.status >= 500 || /update weibo too fast/i.test(apiError.message)));
      const message = cause instanceof Error ? cause.message : "微博发布失败";
      await supabase.rpc("automation_finish_weibo_publish", {
        input_secret: secret,
        input_draft_id: draft.draft_id,
        input_success: false,
        input_post_id: null,
        input_published_url: null,
        input_error: message,
        input_retryable: retryable,
      });
      results.push({ id: draft.draft_id, status: retryable ? "retry_scheduled" : "needs_review" });
    }
  }
  return results;
}
