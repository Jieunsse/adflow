import type { QueryClient } from "@tanstack/react-query";
import type { IgInbox, IgMessage, IgThread } from "@/lib/instagram-messages";

export type InboxEvent = {
  type: "dm_new_message";
  conversationId: string;
  message: {
    id: string;
    from_me: boolean;
    text: string;
    attachment_url?: string;
    created_at: string;
    participant_id: string;
  };
};

export type SendInboxMessageParams = {
  conversationId: string;
  participantId: string;
  text: string;
  isMock: boolean;
};

const inboxKey = ["ig-conversations"] as const;
const threadKey = (conversationId: string) => ["ig-thread", conversationId] as const;

function previewOf(text: string): string {
  return text.length > 70 ? `${text.slice(0, 69)}…` : text;
}

export function reconcileInboxEvent(
  queryClient: QueryClient,
  reloadInbox: () => void,
  event: InboxEvent,
): void {
  const message: IgMessage = {
    id: event.message.id,
    from: event.message.from_me ? "me" : "them",
    text: event.message.text,
    attachmentImageUrl: event.message.attachment_url,
    createdAt: event.message.created_at,
  };

  queryClient.setQueryData<IgThread>(threadKey(event.conversationId), (thread) => {
    if (!thread || thread.messages.some((item) => item.id === message.id)) return thread;
    return { ...thread, messages: [...thread.messages, message] };
  });

  let found = false;
  queryClient.setQueryData<IgInbox>(inboxKey, (inbox) => {
    if (!inbox) return inbox;
    const conversations = inbox.conversations.map((conversation) => {
      if (conversation.id !== event.conversationId) return conversation;
      found = true;
      return {
        ...conversation,
        preview: previewOf(message.text),
        updatedAt: message.createdAt,
      };
    });
    return found ? { ...inbox, conversations } : inbox;
  });

  if (!found) reloadInbox();
}

export async function sendInboxMessage(
  queryClient: QueryClient,
  params: SendInboxMessageParams,
): Promise<void> {
  const createdAt = new Date().toISOString();
  const temporaryId = `local-${Date.now()}`;
  const message: IgMessage = {
    id: temporaryId,
    from: "me",
    text: params.text,
    createdAt,
  };
  const preview = previewOf(params.text);
  const previousConversation = queryClient
    .getQueryData<IgInbox>(inboxKey)
    ?.conversations.find((conversation) => conversation.id === params.conversationId);

  queryClient.setQueryData<IgThread>(threadKey(params.conversationId), (thread) =>
    thread ? { ...thread, messages: [...thread.messages, message] } : thread,
  );
  queryClient.setQueryData<IgInbox>(inboxKey, (inbox) => {
    if (!inbox) return inbox;
    return {
      ...inbox,
      conversations: inbox.conversations.map((conversation) =>
        conversation.id === params.conversationId
          ? { ...conversation, preview, updatedAt: createdAt }
          : conversation,
      ),
    };
  });

  if (params.isMock) return;

  try {
    const response = await fetch(`/api/instagram/conversations/${params.conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: params.participantId, text: params.text }),
    });
    if (!response.ok) throw new Error("send_failed");
    const result = (await response.json()) as { messageId?: string };
    if (!result.messageId) return;

    queryClient.setQueryData<IgThread>(threadKey(params.conversationId), (thread) =>
      thread
        ? {
            ...thread,
            messages: thread.messages.map((item) =>
              item.id === temporaryId ? { ...item, id: result.messageId! } : item,
            ),
          }
        : thread,
    );
  } catch (error) {
    queryClient.setQueryData<IgThread>(threadKey(params.conversationId), (thread) =>
      thread ? { ...thread, messages: thread.messages.filter((item) => item.id !== temporaryId) } : thread,
    );
    queryClient.setQueryData<IgInbox>(inboxKey, (inbox) => {
      if (!inbox || !previousConversation) return inbox;
      return {
        ...inbox,
        conversations: inbox.conversations.map((conversation) =>
          conversation.id === params.conversationId && conversation.preview === preview && conversation.updatedAt === createdAt
            ? previousConversation
            : conversation,
        ),
      };
    });
    throw error;
  }
}
