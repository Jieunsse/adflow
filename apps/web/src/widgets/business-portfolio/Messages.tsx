"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Icon from "@shared/ui/Icon";
import { Card } from "@shared/ui/Card";
import { Button, buttonVariants } from "@shared/ui/Button";
import { cn } from "@shared/lib/cn";
import type {
  IgInbox,
  IgThread,
  IgConversationSummary,
  IgMessage,
} from "@/lib/instagram-messages";
import MessagesPermissionBanner from "./MessagesPermissionBanner";

function relativeTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

function absoluteTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

function initial(handle: string): string {
  return (handle?.[0] ?? "?").toUpperCase();
}

function Avatar({
  handle,
  pictureUrl,
  size = 36,
}: {
  handle: string;
  pictureUrl?: string;
  size?: number;
}) {
  if (pictureUrl) {
    return (
      <img
        src={pictureUrl}
        alt={handle}
        className="rounded-full object-cover flex-none"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full grid place-items-center flex-none font-semibold bg-[var(--w-bg-assistive)] text-[var(--w-fg-neutral)]"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial(handle)}
    </div>
  );
}

function ConversationRow({
  c,
  active,
  onClick,
}: {
  c: IgConversationSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 py-3 px-3.5 rounded-xl border text-left cursor-pointer transition-colors",
        active
          ? "border-[var(--w-primary-normal)] bg-[var(--w-primary-tint)]"
          : "border-transparent bg-transparent hover:bg-[var(--w-bg-alternative)]",
      )}
    >
      <Avatar
        handle={c.participantHandle}
        pictureUrl={c.participantPictureUrl}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            style={{
              font: "600 13.5px/1.3 var(--w-font-sans)",
              color: "var(--w-fg-strong)",
            }}
            className="truncate"
          >
            @{c.participantHandle}
          </span>
          <span
            style={{
              font: "500 11.5px/1 var(--w-font-sans)",
              color: "var(--w-fg-neutral)",
            }}
            className="flex-none"
          >
            {relativeTime(c.updatedAt)}
          </span>
        </div>
        <div
          style={{
            font: "500 12.5px/1.45 var(--w-font-sans)",
            color: "var(--w-fg-neutral)",
            marginTop: 2,
          }}
          className="truncate"
        >
          {c.preview || "(빈 메시지)"}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({
  m,
}: {
  m: {
    from: "me" | "them";
    text: string;
    attachmentImageUrl?: string;
    createdAt: string;
  };
}) {
  const mine = m.from === "me";
  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div
        className="max-w-[72%] flex flex-col gap-1"
        style={{ alignItems: mine ? "flex-end" : "flex-start" }}
      >
        {m.attachmentImageUrl && (
          <img
            src={m.attachmentImageUrl}
            alt=""
            className="rounded-xl max-w-[240px] max-h-[240px] object-cover border border-[var(--w-line-alternative)]"
          />
        )}
        {m.text && (
          <div
            className={cn(
              "py-2.5 px-3.5 rounded-2xl whitespace-pre-wrap break-words",
              mine
                ? "bg-[var(--w-primary-normal)] text-white"
                : "bg-[var(--w-bg-alternative)] text-[var(--w-fg-strong)]",
            )}
            style={{ font: "500 13.5px/1.5 var(--w-font-sans)" }}
          >
            {m.text}
          </div>
        )}
        <span
          style={{
            font: "500 11px/1 var(--w-font-sans)",
            color: "var(--w-fg-neutral)",
          }}
        >
          {absoluteTime(m.createdAt)}
        </span>
      </div>
    </div>
  );
}

function Composer({
  conversationId,
  participantId,
  isMock,
}: {
  conversationId: string;
  participantId: string;
  isMock: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    setText("");
  }, [conversationId]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 140);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > 140 ? "auto" : "hidden";
  }, [text]);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;

    const now = new Date().toISOString();
    const tempId = `local-${Date.now()}`;
    const newMsg: IgMessage = {
      id: tempId,
      from: "me",
      text: value,
      createdAt: now,
    };
    const preview = value.length > 70 ? `${value.slice(0, 69)}…` : value;

    qc.setQueryData<IgThread>(["ig-thread", conversationId], (old) =>
      old ? { ...old, messages: [...old.messages, newMsg] } : old,
    );
    qc.setQueryData<IgInbox>(["ig-conversations"], (old) => {
      if (!old) return old;
      return {
        ...old,
        conversations: old.conversations.map((c) =>
          c.id === conversationId ? { ...c, preview, updatedAt: now } : c,
        ),
      };
    });
    setText("");
    taRef.current?.focus();

    if (isMock) return;

    setSending(true);
    try {
      await fetch(`/api/instagram/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: participantId, text: value }),
      }).then((r) => {
        if (!r.ok) throw new Error("send_failed");
      });
    } catch {
      qc.setQueryData<IgThread>(["ig-thread", conversationId], (old) =>
        old
          ? { ...old, messages: old.messages.filter((m) => m.id !== tempId) }
          : old,
      );
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  const disabled = text.trim().length === 0 || sending;

  return (
    <div className="border-t border-[var(--w-line-alternative)] py-3 px-4 flex items-end gap-2">
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="메시지를 입력하세요."
        rows={1}
        className="flex-1 resize-none outline-none rounded-2xl py-2.5 px-3.5 bg-[var(--w-bg-alternative)] border border-transparent focus:border-[var(--w-primary-normal)] focus:bg-[var(--w-bg-normal)] transition-colors"
        style={{
          font: "500 13.5px/1.5 var(--w-font-sans)",
          color: "var(--w-fg-strong)",
          maxHeight: 140,
        }}
      />
      <button
        type="button"
        onClick={send}
        disabled={disabled}
        aria-label="보내기"
        className={cn(
          "flex-none rounded-full grid place-items-center transition-colors",
          disabled
            ? "bg-[var(--w-bg-alternative)] text-[var(--w-fg-neutral)] cursor-not-allowed"
            : "bg-[var(--w-primary-normal)] text-white hover:opacity-90 cursor-pointer",
        )}
        style={{ width: 36, height: 36 }}
      >
        <Icon name="send" size={16} />
      </button>
    </div>
  );
}

function ThreadPanel({
  conversationId,
  participantId,
}: {
  conversationId: string | null;
  participantId: string;
}) {
  const q = useQuery({
    queryKey: ["ig-thread", conversationId],
    queryFn: async (): Promise<IgThread> => {
      const res = await fetch(
        `/api/instagram/conversations/${conversationId}/messages`,
      );
      if (!res.ok) throw new Error("스레드를 불러오지 못했어요");
      return res.json();
    },
    enabled: !!conversationId,
    staleTime: 60_000,
  });

  if (!conversationId) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--w-fg-neutral)]"
        style={{ minHeight: 480 }}
      >
        <Icon name="message" size={32} style={{ opacity: 0.4 }} />
        <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>
          왼쪽에서 대화를 선택해주세요.
        </span>
      </div>
    );
  }

  if (q.isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ minHeight: 480 }}
      >
        <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-[var(--w-fg-neutral)]"
        style={{ minHeight: 480 }}
      >
        대화를 불러오지 못했어요.
      </div>
    );
  }

  return (
    <ThreadView
      thread={q.data}
      conversationId={conversationId}
      participantId={participantId}
    />
  );
}

function ThreadView({
  thread,
  conversationId,
  participantId,
}: {
  thread: IgThread;
  conversationId: string;
  participantId: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread.messages.length, conversationId]);

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 480 }}>
      <div className="h-14 flex-none flex items-center gap-3 px-4 border-b border-[var(--w-line-alternative)]">
        <Avatar handle={thread.participantHandle} size={32} />
        <div className="flex flex-col">
          <span
            style={{
              font: "600 14px/1.3 var(--w-font-sans)",
              color: "var(--w-fg-strong)",
            }}
          >
            @{thread.participantHandle}
          </span>
          <span
            style={{
              font: "500 11.5px/1 var(--w-font-sans)",
              color: "var(--w-fg-neutral)",
            }}
          >
            메시지 {thread.messages.length}건
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-5 px-5 flex flex-col gap-4"
      >
        {thread.messages.length === 0 ? (
          <div
            className="flex-1 grid place-items-center text-[var(--w-fg-neutral)]"
            style={{ font: "500 13px/1 var(--w-font-sans)" }}
          >
            메시지가 없어요.
          </div>
        ) : (
          thread.messages.map((m) => <MessageBubble key={m.id} m={m} />)
        )}
      </div>
      <Composer
        conversationId={conversationId}
        participantId={participantId}
        isMock={thread.mock}
      />
    </div>
  );
}

export default function Messages() {
  const { data: session } = useSession();
  const [selected, setSelected] = useState<string | null>(null);
  const inboxQ = useQuery({
    queryKey: ["ig-conversations"],
    queryFn: async (): Promise<IgInbox> => {
      const res = await fetch("/api/instagram/conversations");
      if (!res.ok) throw new Error("메시지함을 불러오지 못했어요");
      return res.json();
    },
    staleTime: 60_000,
  });

  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource("/api/instagram/dm-stream");
    es.addEventListener("message", (e) => {
      try {
        const event = JSON.parse(e.data) as {
          type: string;
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
        if (event.type !== "dm_new_message") return;

        const newMsg: IgMessage = {
          id: event.message.id,
          from: event.message.from_me ? "me" : "them",
          text: event.message.text,
          attachmentImageUrl: event.message.attachment_url,
          createdAt: event.message.created_at,
        };
        const preview =
          event.message.text.length > 70
            ? `${event.message.text.slice(0, 69)}…`
            : event.message.text;

        // 스레드 캐시에 메시지 append
        qc.setQueryData<IgThread>(["ig-thread", event.conversationId], (old) =>
          old ? { ...old, messages: [...old.messages, newMsg] } : old,
        );
        // 대화 목록 preview·updatedAt 갱신
        qc.setQueryData<IgInbox>(["ig-conversations"], (old) => {
          if (!old) return old;
          return {
            ...old,
            conversations: old.conversations.map((c) =>
              c.id === event.conversationId
                ? { ...c, preview, updatedAt: event.message.created_at }
                : c,
            ),
          };
        });
      } catch {}
    });
    return () => es.close();
  }, [qc]);

  if (inboxQ.isLoading) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 px-5 text-[var(--w-fg-neutral)]">
        <div className="rounded-full border-[2.4px] border-[var(--w-line-normal)] border-t-[var(--w-primary-normal)] animate-[spin_0.85s_linear_infinite] w-[18px] h-[18px]" />
        <span style={{ font: "500 13px/1 var(--w-font-sans)" }}>
          메시지함을 불러오는 중…
        </span>
      </Card>
    );
  }

  if (inboxQ.isError || !inboxQ.data) {
    if (!session?.pageId) {
      return (
        <Card className="flex items-center justify-between gap-4">
          <div>
            <div style={{ font: "700 15px/1.3 var(--w-font-sans)", color: "var(--w-fg-strong)" }}>Meta 계정이 아직 연결되지 않았어요</div>
            <div style={{ font: "500 12.5px/1.5 var(--w-font-sans)", color: "var(--w-fg-neutral)", marginTop: 4 }}>Facebook 페이지와 Instagram 비즈니스 계정을 연결하면 메시지함을 볼 수 있어요.</div>
          </div>
          <Link href="/connect" className={buttonVariants({ variant: "primary", size: "sm" })}>계정 연결하러 가기</Link>
        </Card>
      );
    }
    return (
      <Card className="flex flex-col items-center gap-3 py-10 px-5 text-center text-[var(--w-fg-neutral)]">
        <span style={{ font: "500 13px/1.4 var(--w-font-sans)" }}>메시지함을 불러오지 못했어요.</span>
        <Button variant="primary" size="sm" type="button" onClick={() => inboxQ.refetch()}>다시 시도</Button>
      </Card>
    );
  }

  const inbox = inboxQ.data;
  const conversations = inbox.conversations;
  const selectedConv = conversations.find((c) => c.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {inbox.mock && <MessagesPermissionBanner />}
      <Card className="p-0 overflow-hidden">
        <div className="flex" style={{ minHeight: 520 }}>
          <div className="w-[340px] flex-none border-r border-[var(--w-line-alternative)] flex flex-col">
            <div className="h-14 flex-none px-4 border-b border-[var(--w-line-alternative)] flex items-center justify-between">
              <span
                style={{
                  font: "600 13.5px/1.3 var(--w-font-sans)",
                  color: "var(--w-fg-strong)",
                }}
              >
                메시지함
              </span>
              <span
                style={{
                  font: "500 11.5px/1 var(--w-font-sans)",
                  color: "var(--w-fg-neutral)",
                }}
              >
                {conversations.length}건
              </span>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-1">
              {conversations.length === 0 ? (
                <div
                  className="flex-1 grid place-items-center text-center px-4 text-[var(--w-fg-neutral)]"
                  style={{ font: "500 13px/1.5 var(--w-font-sans)" }}
                >
                  아직 받은 메시지가 없어요.
                </div>
              ) : (
                conversations.map((c) => (
                  <ConversationRow
                    key={c.id}
                    c={c}
                    active={selected === c.id}
                    onClick={() => setSelected(c.id)}
                  />
                ))
              )}
            </div>
          </div>
          <ThreadPanel
            conversationId={selected}
            participantId={selectedConv?.participantId ?? ""}
          />
        </div>
      </Card>
    </div>
  );
}
