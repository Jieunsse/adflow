type DmController = ReadableStreamDefaultController<Uint8Array>
type DmEventListener = (payload: unknown) => void
type DmSubscription = { controller: DmController; onEvent?: DmEventListener }

const registry = new Map<string, Set<DmSubscription>>()

export function addDmController(
  igUserId: string,
  controller: DmController,
  onEvent?: DmEventListener,
): void {
  if (!registry.has(igUserId)) registry.set(igUserId, new Set())
  registry.get(igUserId)!.add({ controller, onEvent })
}

export function removeDmController(igUserId: string, controller: DmController): void {
  const set = registry.get(igUserId)
  if (!set) return
  for (const subscription of set) {
    if (subscription.controller === controller) set.delete(subscription)
  }
  if (set.size === 0) registry.delete(igUserId)
}

export function pushDmEvent(igUserId: string, payload: unknown): void {
  const set = registry.get(igUserId)
  if (!set || set.size === 0) return
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
  for (const subscription of set) {
    try {
      subscription.onEvent?.(payload)
      subscription.controller.enqueue(encoded)
    } catch {
      set.delete(subscription)
    }
  }
  if (set.size === 0) registry.delete(igUserId)
}

// 테스트 전용
export function _resetForTest(): void {
  registry.clear()
}
export function _registrySize(): number {
  return registry.size
}
export function _controllerCount(igUserId: string): number {
  return registry.get(igUserId)?.size ?? 0
}
