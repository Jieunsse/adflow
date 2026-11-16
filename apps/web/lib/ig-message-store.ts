// 인스타 DM 캐시의 Spring 통로. server-side only.
//
// 단계 4 — Supabase 직접 접근을 걷어냈다. webhook 은 세션 없이 호출되므로 사용자 JWT 를 쓰는
// callBackend 대신 내부 시크릿으로 부른다. 읽기 경로도 같은 문을 쓴다(인증 모드를 하나로).
//
// 실패는 전부 삼킨다 — DM 캐시는 Meta Graph 의 사본이고, 캐시 실패가 화면을 깨면 안 된다.

import { backendBaseUrl, internalSecret } from "@shared/lib/backend/client";

export type IgMessageRow = {
  id: string;
  igUserId: string;
  conversationId: string;
  participantId: string;
  participantHandle?: string;
  fromMe: boolean;
  text?: string;
  attachmentUrl?: string;
  createdAt: string;
};

async function call(path: string, init?: { method: string; body: string }): Promise<Response | null> {
  const base = backendBaseUrl();
  const secret = internalSecret();
  // 미설정이면 조용히 건너뛴다 — 배포 환경(백엔드 미배포)의 자동 휴면 계약.
  if (!base || !secret) return null;

  try {
    return await fetch(`${base}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "X-Internal-Secret": secret,
        ...(init ? { "Content-Type": "application/json" } : {}),
      },
      ...(init ? { body: init.body } : {}),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function saveIgMessages(items: IgMessageRow[]): Promise<void> {
  if (items.length === 0) return;
  await call("/internal/ig-messages", { method: "POST", body: JSON.stringify({ items }) });
}

/** conversationId 를 주면 그 스레드(오래된 순), 없으면 인박스 전체(최신순). */
export async function readIgMessages(
  igUserId: string,
  conversationId?: string,
): Promise<IgMessageRow[]> {
  const query = new URLSearchParams({ igUserId });
  if (conversationId) query.set("conversationId", conversationId);

  const res = await call(`/internal/ig-messages?${query}`);
  if (!res?.ok) return [];

  const { items } = (await res.json()) as { items: IgMessageRow[] };
  return items;
}

/** Meta webhook 은 conversation_id 를 주지 않는다 — 같은 상대와의 최근 대화에서 역조회한다. */
export async function findConversationId(
  igUserId: string,
  participantId: string,
): Promise<string | null> {
  const query = new URLSearchParams({ igUserId, participantId });
  const res = await call(`/internal/ig-messages/conversation-id?${query}`);
  if (!res?.ok || res.status === 204) return null;

  const { conversationId } = (await res.json()) as { conversationId: string };
  return conversationId ?? null;
}
