const GRAPH = "https://graph.facebook.com/v20.0"

export type IgConversationSummary = {
  id: string
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
    { id: "c1", participantHandle: "minji_lee",   preview: "사이즈 XL 도 있나요? 색상은 베이지 가능?", updatedAt: "2026-05-22T13:42:00Z" },
    { id: "c2", participantHandle: "studio.kim",  preview: "협업 문의 드려요. 인스타 DM 이 편하실까요?",  updatedAt: "2026-05-22T09:15:00Z" },
    { id: "c3", participantHandle: "yuna___",      preview: "주말 픽업 가능한가요? 토요일 오후 2시",        updatedAt: "2026-05-21T18:20:00Z" },
    { id: "c4", participantHandle: "daily.shop",   preview: "감사합니다! 잘 받았어요 ✨",                    updatedAt: "2026-05-20T20:05:00Z" },
    { id: "c5", participantHandle: "j_eunji",      preview: "광고 보고 연락 드려요. 가격 안내 부탁 ​드릴게요", updatedAt: "2026-05-19T11:30:00Z" },
  ],
}

const MOCK_THREADS: Record<string, Omit<IgThread, 'mock'>> = {
  c1: {
    conversationId: "c1",
    participantHandle: "minji_lee",
    messages: [
      { id: "m1", from: "them", text: "안녕하세요! 어제 인스타 광고 보고 연락드려요", createdAt: "2026-05-22T13:30:00Z" },
      { id: "m2", from: "them", text: "사이즈 XL 도 있나요?",                        createdAt: "2026-05-22T13:31:00Z" },
      { id: "m3", from: "me",   text: "안녕하세요 :) XL 까지 모두 재고 있어요!",       createdAt: "2026-05-22T13:38:00Z" },
      { id: "m4", from: "them", text: "색상은 베이지도 가능한가요?",                  createdAt: "2026-05-22T13:40:00Z" },
      { id: "m5", from: "me",   text: "베이지·차콜·아이보리 3색 중 고르실 수 있어요", createdAt: "2026-05-22T13:42:00Z" },
    ],
  },
  c2: {
    conversationId: "c2",
    participantHandle: "studio.kim",
    messages: [
      { id: "m1", from: "them", text: "안녕하세요. 스튜디오 김 입니다.",               createdAt: "2026-05-22T09:00:00Z" },
      { id: "m2", from: "them", text: "협업 컨텐츠 한 번 같이 해보고 싶어서 연락드려요", createdAt: "2026-05-22T09:01:00Z" },
      { id: "m3", from: "me",   text: "와 안녕하세요! 어떤 방향 생각하세요?",          createdAt: "2026-05-22T09:10:00Z" },
      { id: "m4", from: "them", text: "5월 말 시즌룩 협업이요. 자료 보내드릴게요",     createdAt: "2026-05-22T09:15:00Z" },
    ],
  },
  c3: {
    conversationId: "c3",
    participantHandle: "yuna___",
    messages: [
      { id: "m1", from: "them", text: "주문한 거 매장 픽업 가능한가요?",   createdAt: "2026-05-21T18:18:00Z" },
      { id: "m2", from: "them", text: "토요일 오후 2시쯤 들를게요",         createdAt: "2026-05-21T18:20:00Z" },
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

async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${userToken}`)
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

async function getIgUserId(pageId: string, pageToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`)
    const data = await res.json() as { instagram_business_account?: { id: string } }
    return data.instagram_business_account?.id ?? null
  } catch {
    return null
  }
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
    `&fields=participants,updated_time,messages.limit(1){message,from,created_time}` +
    `&limit=20&access_token=${token}`
  )
  if (!res.ok) return IG_INBOX_MOCK

  const data = await res.json() as {
    data?: Array<{
      id: string
      updated_time?: string
      participants?: { data?: Array<{ id: string; username?: string }> }
      messages?: { data?: Array<{ message?: string; created_time?: string }> }
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
      participantHandle: handle,
      participantPictureUrl: pictureUrl,
      preview: truncate(lastMsg?.message ?? '', 70),
      updatedAt: row.updated_time ?? lastMsg?.created_time ?? '',
    } satisfies IgConversationSummary
  }))

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
    const pageToken = await getPageToken(pageId, userToken)
    if (!pageToken) return getMockThread(conversationId)
    const igUserId = igUserIdHint || (await getIgUserId(pageId, pageToken))
    if (!igUserId) return getMockThread(conversationId)
    return await fetchThreadWithToken(conversationId, igUserId, pageToken)
  } catch {
    return getMockThread(conversationId)
  }
}
