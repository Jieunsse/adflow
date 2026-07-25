import { GRAPH, getPageToken, getIgUserId } from "./instagram-graph"
import { getSupabaseServer } from "@shared/lib/supabase-server"

type DbRow = {
  id: string
  ig_user_id: string
  conversation_id: string
  participant_id: string
  participant_handle?: string
  from_me: boolean
  text?: string
  attachment_url?: string
  created_at: string
}

async function upsertMessages(rows: DbRow[]): Promise<void> {
  if (rows.length === 0) return
  const sb = getSupabaseServer()
  if (!sb) return
  await sb.from('ig_messages').upsert(rows, { onConflict: 'id' })
}

async function getInboxFromSupabase(igUserId: string): Promise<IgInbox | null> {
  const sb = getSupabaseServer()
  if (!sb) return null
  const { data } = await sb
    .from('ig_messages')
    .select('conversation_id, participant_id, participant_handle, text, created_at')
    .eq('ig_user_id', igUserId)
    .order('created_at', { ascending: false })
  if (!data || data.length === 0) return null

  const seen = new Set<string>()
  const summaries: IgConversationSummary[] = []
  for (const row of data as DbRow[]) {
    if (!seen.has(row.conversation_id)) {
      seen.add(row.conversation_id)
      summaries.push({
        id: row.conversation_id,
        participantId: row.participant_id,
        participantHandle: row.participant_handle ?? 'unknown',
        preview: truncate(row.text ?? '', 70),
        updatedAt: row.created_at,
      })
    }
  }
  return { conversations: summaries, mock: false }
}

async function getThreadFromSupabase(conversationId: string): Promise<IgThread | null> {
  const sb = getSupabaseServer()
  if (!sb) return null
  const { data } = await sb
    .from('ig_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (!data || data.length === 0) return null

  const rows = data as DbRow[]
  const handle = rows.find(r => r.participant_handle)?.participant_handle ?? 'unknown'
  return {
    conversationId,
    participantHandle: handle,
    messages: rows.map(r => ({
      id: r.id,
      from: r.from_me ? ('me' as const) : ('them' as const),
      text: r.text ?? '',
      attachmentImageUrl: r.attachment_url,
      createdAt: r.created_at,
    })),
    mock: false,
  }
}

export type IgConversationSummary = {
  id: string
  participantId: string
  participantHandle: string
  participantPictureUrl?: string
  preview: string
  updatedAt: string
}

export type IgMessage = {
  id: string
  from: 'me' | 'them'
  text: string
  attachmentImageUrl?: string
  createdAt: string
}

export type IgInbox = {
  conversations: IgConversationSummary[]
  mock: boolean
}

export type IgThread = {
  conversationId: string
  participantHandle: string
  messages: IgMessage[]
  mock: boolean
}

export const IG_INBOX_MOCK: IgInbox = {
  mock: true,
  conversations: [
    { id: "c1", participantId: "mock-1", participantHandle: "minji_lee",   preview: "수분 크림 지성 피부도 괜찮나요? 무향인가요?", updatedAt: "2026-05-22T13:42:00Z" },
    { id: "c2", participantId: "mock-2", participantHandle: "studio.kim",  preview: "협업 문의 드려요. 인스타 DM 이 편하실까요?",  updatedAt: "2026-05-22T09:15:00Z" },
    { id: "c3", participantId: "mock-3", participantHandle: "yuna___",      preview: "선크림 품절이던데 재입고 언제 되나요?",       updatedAt: "2026-05-21T18:20:00Z" },
    { id: "c4", participantId: "mock-4", participantHandle: "daily.shop",   preview: "감사합니다! 잘 받았어요 ✨",                    updatedAt: "2026-05-20T20:05:00Z" },
    { id: "c5", participantId: "mock-5", participantHandle: "j_eunji",      preview: "광고 보고 연락 드려요. 세트 가격 안내 부탁​드릴게요", updatedAt: "2026-05-19T11:30:00Z" },
  ],
}

const MOCK_THREADS: Record<string, Omit<IgThread, 'mock'>> = {
  c1: {
    conversationId: "c1",
    participantHandle: "minji_lee",
    messages: [
      { id: "m1", from: "them", text: "안녕하세요! 어제 인스타 광고 보고 연락드려요", createdAt: "2026-05-22T13:30:00Z" },
      { id: "m2", from: "them", text: "수분 크림이 지성 피부에도 괜찮을까요?",        createdAt: "2026-05-22T13:31:00Z" },
      { id: "m3", from: "me",   text: "안녕하세요 :) 무겁지 않은 제형이라 지성 피부도 편하게 쓰실 수 있어요!", createdAt: "2026-05-22T13:38:00Z" },
      { id: "m4", from: "them", text: "무향인가요?",                                createdAt: "2026-05-22T13:40:00Z" },
      { id: "m5", from: "me",   text: "네, 무향·무색소예요. 민감한 피부도 안심하고 쓰실 수 있어요 🌿", createdAt: "2026-05-22T13:42:00Z" },
    ],
  },
  c2: {
    conversationId: "c2",
    participantHandle: "studio.kim",
    messages: [
      { id: "m1", from: "them", text: "안녕하세요. 스튜디오 김 입니다.",               createdAt: "2026-05-22T09:00:00Z" },
      { id: "m2", from: "them", text: "협업 컨텐츠 한 번 같이 해보고 싶어서 연락드려요", createdAt: "2026-05-22T09:01:00Z" },
      { id: "m3", from: "me",   text: "와 안녕하세요! 어떤 방향 생각하세요?",          createdAt: "2026-05-22T09:10:00Z" },
      { id: "m4", from: "them", text: "비건 스킨케어 루틴 협업이요. 자료 보내드릴게요", createdAt: "2026-05-22T09:15:00Z" },
    ],
  },
  c3: {
    conversationId: "c3",
    participantHandle: "yuna___",
    messages: [
      { id: "m1", from: "them", text: "선크림 품절이던데 재입고 언제 되나요?", createdAt: "2026-05-21T18:18:00Z" },
      { id: "m2", from: "me",   text: "다음 주 초 재입고 예정이에요! 알림 신청해두시면 문자로 안내드릴게요 :)", createdAt: "2026-05-21T18:20:00Z" },
    ],
  },
  c4: {
    conversationId: "c4",
    participantHandle: "daily.shop",
    messages: [
      { id: "m1", from: "me",   text: "오늘 배송 완료됐어요!",        createdAt: "2026-05-20T19:50:00Z" },
      { id: "m2", from: "them", text: "감사합니다! 잘 받았어요 ✨",   createdAt: "2026-05-20T20:05:00Z" },
    ],
  },
  c5: {
    conversationId: "c5",
    participantHandle: "j_eunji",
    messages: [
      { id: "m1", from: "them", text: "광고 보고 연락드려요",            createdAt: "2026-05-19T11:25:00Z" },
      { id: "m2", from: "them", text: "가격 안내 부탁드릴게요",          createdAt: "2026-05-19T11:30:00Z" },
    ],
  },
}

export const IG_THREAD_MOCK_DEFAULT: IgThread = { ...MOCK_THREADS.c1, mock: true }

export function getMockThread(conversationId: string): IgThread {
  const t = MOCK_THREADS[conversationId] ?? MOCK_THREADS.c1
  return { ...t, mock: true }
}

async function fetchParticipantPicture(igsid: string, token: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${GRAPH}/${igsid}?fields=profile_pic&access_token=${token}`)
    if (!res.ok) return undefined
    const data = await res.json() as { profile_pic?: string }
    return data.profile_pic
  } catch {
    return undefined
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

async function fetchInboxWithToken(igUserId: string, token: string): Promise<IgInbox> {
  const res = await fetch(
    `${GRAPH}/${igUserId}/conversations?platform=instagram` +
    `&fields=participants,updated_time,messages.limit(1){id,message,from,created_time}` +
    `&limit=20&access_token=${token}`
  )
  if (!res.ok) return IG_INBOX_MOCK

  const data = await res.json() as {
    data?: Array<{
      id: string
      updated_time?: string
      participants?: { data?: Array<{ id: string; username?: string }> }
      messages?: { data?: Array<{ id?: string; message?: string; from?: { id: string }; created_time?: string }> }
    }>
  }
  const rows = data.data ?? []
  if (rows.length === 0) return { conversations: [], mock: false }

  const summaries = await Promise.all(rows.map(async (row) => {
    const other = row.participants?.data?.find(p => p.id !== igUserId)
    const handle = other?.username ?? 'unknown'
    const lastMsg = row.messages?.data?.[0]
    const pictureUrl = other?.id ? await fetchParticipantPicture(other.id, token) : undefined
    return {
      id: row.id,
      participantId: other?.id ?? '',
      participantHandle: handle,
      participantPictureUrl: pictureUrl,
      preview: truncate(lastMsg?.message ?? '', 70),
      updatedAt: row.updated_time ?? lastMsg?.created_time ?? '',
    } satisfies IgConversationSummary
  }))

  // Supabase 씨앗 심기 — 각 대화의 최신 메시지 1건 upsert
  const seedRows: DbRow[] = rows.flatMap(row => {
    const other = row.participants?.data?.find(p => p.id !== igUserId)
    const lastMsg = row.messages?.data?.[0]
    if (!lastMsg?.id) return []
    return [{
      id: lastMsg.id,
      ig_user_id: igUserId,
      conversation_id: row.id,
      participant_id: other?.id ?? '',
      participant_handle: other?.username,
      from_me: lastMsg.from?.id === igUserId,
      text: lastMsg.message ?? '',
      created_at: lastMsg.created_time ?? row.updated_time ?? '',
    }]
  })
  await upsertMessages(seedRows)

  return { conversations: summaries, mock: false }
}

async function fetchThreadWithToken(
  conversationId: string,
  igUserId: string,
  token: string,
): Promise<IgThread> {
  const res = await fetch(
    `${GRAPH}/${conversationId}` +
    `?fields=messages.limit(50){message,from,attachments{image_data},created_time},participants` +
    `&access_token=${token}`
  )
  if (!res.ok) return getMockThread(conversationId)

  const data = await res.json() as {
    participants?: { data?: Array<{ id: string; username?: string }> }
    messages?: {
      data?: Array<{
        id: string
        message?: string
        from?: { id: string; username?: string }
        attachments?: { data?: Array<{ image_data?: { url?: string } }> }
        created_time?: string
      }>
    }
  }

  const other = data.participants?.data?.find(p => p.id !== igUserId)
  const handle = other?.username ?? 'unknown'

  const rawMessages = data.messages?.data ?? []
  // Graph API 는 최신순으로 줘서 오래된 → 최신 으로 뒤집어요.
  const messages: IgMessage[] = [...rawMessages].reverse().map(m => ({
    id: m.id,
    from: m.from?.id === igUserId ? 'me' : 'them',
    text: m.message ?? '',
    attachmentImageUrl: m.attachments?.data?.[0]?.image_data?.url,
    createdAt: m.created_time ?? '',
  }))

  // Supabase 전체 스레드 upsert (첫 스레드 열람 시 씨앗 완성)
  await upsertMessages(messages.map(m => ({
    id: m.id,
    ig_user_id: igUserId,
    conversation_id: conversationId,
    participant_id: other?.id ?? '',
    participant_handle: handle,
    from_me: m.from === 'me',
    text: m.text,
    attachment_url: m.attachmentImageUrl,
    created_at: m.createdAt,
  })))

  return { conversationId, participantHandle: handle, messages, mock: false }
}

export async function getInstagramInbox(
  pageId: string | undefined,
  userToken: string | undefined,
  igUserIdHint?: string,
): Promise<IgInbox> {
  if (!pageId || !userToken) return IG_INBOX_MOCK
  try {
    const pageToken = await getPageToken(pageId, userToken)
    if (!pageToken) return IG_INBOX_MOCK
    const igUserId = igUserIdHint || (await getIgUserId(pageId, pageToken))
    if (!igUserId) return IG_INBOX_MOCK

    // 재연결 경로: Supabase에 씨앗이 있으면 DB 반환
    const cached = await getInboxFromSupabase(igUserId)
    if (cached) return cached

    // 첫 진입 경로: Meta API fetch + Supabase 씨앗 심기
    return await fetchInboxWithToken(igUserId, pageToken)
  } catch {
    return IG_INBOX_MOCK
  }
}

export async function getInstagramThread(
  conversationId: string,
  pageId: string | undefined,
  userToken: string | undefined,
  igUserIdHint?: string,
): Promise<IgThread> {
  if (!pageId || !userToken) return getMockThread(conversationId)
  try {
    // 재연결 경로: Supabase에 스레드가 있으면 DB 반환
    const cached = await getThreadFromSupabase(conversationId)
    if (cached) return cached

    const pageToken = await getPageToken(pageId, userToken)
    if (!pageToken) return getMockThread(conversationId)
    const igUserId = igUserIdHint || (await getIgUserId(pageId, pageToken))
    if (!igUserId) return getMockThread(conversationId)

    // 첫 진입 경로: Meta API fetch + Supabase upsert
    return await fetchThreadWithToken(conversationId, igUserId, pageToken)
  } catch {
    return getMockThread(conversationId)
  }
}

export async function sendInstagramMessage(
  recipientId: string,
  text: string,
  pageId: string | undefined,
  userToken: string | undefined,
): Promise<{ messageId: string }> {
  if (!pageId || !userToken) throw new Error('no_session')
  const pageToken = await getPageToken(pageId, userToken)
  if (!pageToken) throw new Error('no_page_token')
  const igUserId = await getIgUserId(pageId, pageToken)
  if (!igUserId) throw new Error('no_ig_user')

  const res = await fetch(`${GRAPH}/${igUserId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? 'send_failed')
  }
  const data = await res.json() as { message_id?: string }
  return { messageId: data.message_id ?? '' }
}
