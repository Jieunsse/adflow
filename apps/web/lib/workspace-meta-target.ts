import { getSupabaseServer } from "@shared/lib/supabase/server";

export type WorkspaceMetaTarget = {
  adAccountId?: string; adAccountName?: string; pageId?: string; pageName?: string;
  pixelId?: string; pixelName?: string; igUserId?: string; igUsername?: string;
};
export type WorkspaceTargetAudit = { actor: string; timestamp: string; before: WorkspaceMetaTarget; after: WorkspaceMetaTarget };
const KEY = "workspace";

export async function getWorkspaceMetaTarget(): Promise<WorkspaceMetaTarget> {
  const sb = getSupabaseServer();
  if (!sb) throw new Error("workspace_meta_target_not_configured");
  const { data, error } = await sb.from("workspace_meta_targets").select("data").eq("user_email", KEY).maybeSingle();
  if (error) throw error;
  return (data?.data as WorkspaceMetaTarget | null) ?? {};
}

export async function getWorkspaceMetaTargetAudit(): Promise<WorkspaceTargetAudit[]> {
  const sb = getSupabaseServer();
  if (!sb) throw new Error("workspace_meta_target_not_configured");
  const { data, error } = await sb.from("workspace_meta_target_audits").select("actor, created_at, before_data, after_data").eq("user_email", KEY).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ actor: row.actor, timestamp: row.created_at, before: row.before_data ?? {}, after: row.after_data ?? {} }));
}

export async function updateWorkspaceMetaTarget(patch: WorkspaceMetaTarget, actor: string): Promise<WorkspaceMetaTarget> {
  const sb = getSupabaseServer();
  if (!sb) throw new Error("workspace_meta_target_not_configured");
  const before = await getWorkspaceMetaTarget();
  const after = { ...before, ...patch };
  const { error } = await sb.from("workspace_meta_targets").upsert({ user_email: KEY, data: after, updated_at: new Date().toISOString() });
  if (error) throw error;
  const audit = await sb.from("workspace_meta_target_audits").insert({ user_email: KEY, actor, action: "update", before_data: before, after_data: after });
  if (audit.error) throw audit.error;
  return after;
}
