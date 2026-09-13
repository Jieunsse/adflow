import { getSupabaseServer } from "./supabase-server";

// ADR-043 — Notion Connection 영속. server-side only.
// user_key = NextAuth sub/email (라우트에서 getToken 으로 해석해 넘긴다).
const TABLE = "notion_connections";

export type NotionConnection = {
  accessToken: string;
  botId?: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceIcon?: string;
};

export type WorkspaceNotionAudit = { actor: string; action: "set" | "clear"; timestamp: string };

export async function getWorkspaceNotionAudit(): Promise<WorkspaceNotionAudit[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];
  const { data } = await supabase.from("workspace_notion_audits").select("actor, action, created_at").eq("user_email", "workspace").order("created_at", { ascending: true });
  return (data ?? []).map((row) => ({ actor: row.actor, action: row.action, timestamp: row.created_at }));
}

export async function getWorkspaceNotionOwner(): Promise<string | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.from("workspace_notion_settings").select("owner_key").eq("user_email", "workspace").maybeSingle();
  return (data?.owner_key as string | undefined) ?? null;
}

export async function setWorkspaceNotionOwner(ownerKey: string, actor: string): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase.from("workspace_notion_settings").upsert({ user_email: "workspace", owner_key: ownerKey });
  await supabase.from("workspace_notion_audits").insert({ user_email: "workspace", actor, action: "set" });
}

export async function clearWorkspaceNotionOwner(actor: string): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  await supabase.from("workspace_notion_settings").delete().eq("user_email", "workspace");
  await supabase.from("workspace_notion_audits").insert({ user_email: "workspace", actor, action: "clear" });
}

export async function getNotionConnection(userKey: string): Promise<NotionConnection | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("access_token, bot_id, workspace_id, workspace_name, workspace_icon")
    .eq("user_key", userKey)
    .maybeSingle();
  if (error || !data) return null;
  return {
    accessToken: data.access_token,
    botId: data.bot_id ?? undefined,
    workspaceId: data.workspace_id ?? undefined,
    workspaceName: data.workspace_name ?? undefined,
    workspaceIcon: data.workspace_icon ?? undefined,
  };
}

export async function saveNotionConnection(userKey: string, conn: NotionConnection): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).upsert({
    user_key: userKey,
    access_token: conn.accessToken,
    bot_id: conn.botId ?? null,
    workspace_id: conn.workspaceId ?? null,
    workspace_name: conn.workspaceName ?? null,
    workspace_icon: conn.workspaceIcon ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("[notion-store] saveNotionConnection 실패", error.message);
}

export async function deleteNotionConnection(userKey: string): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).delete().eq("user_key", userKey);
  if (error) console.error("[notion-store] deleteNotionConnection 실패", error.message);
}
