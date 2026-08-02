import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { IgInbox, IgThread } from "@/lib/instagram-messages";
import { reconcileInboxEvent, sendInboxMessage } from "./inbox-state";

function inbox(): IgInbox {
  return {
    mock: false,
    conversations: [{
      id: "c-1",
      participantId: "p-1",
      participantHandle: "minji",
      preview: "이전 메시지",
      updatedAt: "2026-08-01T00:00:00.000Z",
    }],
  };
}

describe("reconcileInboxEvent", () => {
  it("목록에 없는 대화의 새 메시지는 Inbox를 다시 읽는다", () => {
    const queryClient = new QueryClient();
    const reloadInbox = vi.fn();
    queryClient.setQueryData<IgInbox>(["ig-conversations"], inbox());

    reconcileInboxEvent(queryClient, reloadInbox, {
      type: "dm_new_message",
      conversationId: "c-new",
      message: {
        id: "m-new",
        from_me: false,
        text: "처음 온 메시지",
        created_at: "2026-08-02T00:00:00.000Z",
        participant_id: "p-new",
      },
    });

    expect(reloadInbox).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData<IgInbox>(["ig-conversations"])?.conversations).toHaveLength(1);
  });

  it("열어 둔 Thread에는 같은 메시지를 한 번만 반영한다", () => {
    const queryClient = new QueryClient();
    const reloadInbox = vi.fn();
    const thread: IgThread = {
      conversationId: "c-1",
      participantHandle: "minji",
      mock: false,
      messages: [],
    };
    queryClient.setQueryData<IgInbox>(["ig-conversations"], inbox());
    queryClient.setQueryData<IgThread>(["ig-thread", "c-1"], thread);
    const event = {
      type: "dm_new_message" as const,
      conversationId: "c-1",
      message: {
        id: "m-1",
        from_me: false,
        text: "안녕하세요",
        created_at: "2026-08-02T00:00:00.000Z",
        participant_id: "p-1",
      },
    };

    reconcileInboxEvent(queryClient, reloadInbox, event);
    reconcileInboxEvent(queryClient, reloadInbox, event);

    expect(queryClient.getQueryData<IgThread>(["ig-thread", "c-1"])?.messages).toHaveLength(1);
    expect(queryClient.getQueryData<IgInbox>(["ig-conversations"])?.conversations[0]).toMatchObject({
      preview: "안녕하세요",
      updatedAt: "2026-08-02T00:00:00.000Z",
    });
  });

  it("발송 성공 후 임시 메시지를 서버 메시지로 바꾼다", async () => {
    const queryClient = new QueryClient();
    const thread: IgThread = {
      conversationId: "c-1",
      participantHandle: "minji",
      mock: false,
      messages: [],
    };
    queryClient.setQueryData<IgInbox>(["ig-conversations"], inbox());
    queryClient.setQueryData<IgThread>(["ig-thread", "c-1"], thread);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "m-server" }),
    }));

    await sendInboxMessage(queryClient, {
      conversationId: "c-1",
      participantId: "p-1",
      text: "답변입니다",
      isMock: false,
    });

    expect(queryClient.getQueryData<IgThread>(["ig-thread", "c-1"])?.messages).toEqual([
      expect.objectContaining({ id: "m-server", text: "답변입니다", from: "me" }),
    ]);
    vi.unstubAllGlobals();
  });
});
