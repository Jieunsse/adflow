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
