type IgPending = { igAccessToken: string; igUserId: string; igUsername: string; expiresAt: number }

// Next.js dev 서버는 단일 프로세스이므로 모듈 스코프 Map이 안전하게 공유됨
const store = new Map<string, IgPending>()

export function putIgPending(key: string, data: Omit<IgPending, "expiresAt">) {
  store.set(key, { ...data, expiresAt: Date.now() + 5 * 60 * 1000 })
}

export function popIgPending(key: string): Omit<IgPending, "expiresAt"> | null {
  const entry = store.get(key)
  if (!entry) return null
  store.delete(key)
  if (Date.now() > entry.expiresAt) return null
  const { expiresAt: _, ...data } = entry
  return data
}
