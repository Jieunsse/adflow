type DmController = ReadableStreamDefaultController<Uint8Array>

const registry = new Map<string, Set<DmController>>()

export function addDmController(igUserId: string, controller: DmController): void {
  if (!registry.has(igUserId)) registry.set(igUserId, new Set())
  registry.get(igUserId)!.add(controller)
}

export function removeDmController(igUserId: string, controller: DmController): void {
  const set = registry.get(igUserId)
  if (!set) return
  set.delete(controller)
  if (set.size === 0) registry.delete(igUserId)
}

export function pushDmEvent(igUserId: string, payload: unknown): void {
  const set = registry.get(igUserId)
  if (!set || set.size === 0) return
  const encoded = new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
  for (const ctrl of set) {
    try {
      ctrl.enqueue(encoded)
    } catch {
      set.delete(ctrl)
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
