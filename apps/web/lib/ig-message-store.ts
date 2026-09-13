import { getSupabaseServer } from "@shared/lib/supabase/server";

export type IgMessageRow = {
  id: string; igUserId: string; conversationId: string; participantId: string;
  participantHandle?: string; fromMe: boolean; text?: string; attachmentUrl?: string; createdAt: string;
};

function client() {
  const sb = getSupabaseServer();
  if (!sb) throw new Error("ig_message_store_unavailable");
  return sb;
}

export async function saveIgMessages(items: IgMessageRow[]): Promise<void> {
  if (!items.length) return;
  const rows = items.map((item) => ({ id: item.id, ig_user_id: item.igUserId, conversation_id: item.conversationId, participant_id: item.participantId, participant_handle: item.participantHandle, from_me: item.fromMe, text: item.text, attachment_url: item.attachmentUrl, created_at: item.createdAt }));
  const { error } = await client().from("ig_messages").upsert(rows);
  if (error) throw new Error(`ig_message_store_${error.code ?? "write"}`);
}

export async function readIgMessages(igUserId: string, conversationId?: string): Promise<IgMessageRow[]> {
  let query = client().from("ig_messages").select("*").eq("ig_user_id", igUserId);
  if (conversationId) query = query.eq("conversation_id", conversationId).order("created_at", { ascending: true });
  else query = query.order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map((row) => ({ id: row.id, igUserId: row.ig_user_id, conversationId: row.conversation_id, participantId: row.participant_id, participantHandle: row.participant_handle, fromMe: row.from_me, text: row.text, attachmentUrl: row.attachment_url, createdAt: row.created_at }));
}

export async function findConversationId(igUserId: string, participantId: string): Promise<string | null> {
  const { data } = await client().from("ig_messages").select("conversation_id").eq("ig_user_id", igUserId).eq("participant_id", participantId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data?.conversation_id as string | undefined) ?? null;
}
