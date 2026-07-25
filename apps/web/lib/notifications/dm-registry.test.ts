import { afterEach, describe, expect, it } from "vitest"
import {
  _controllerCount,
  _registrySize,
  _resetForTest,
  addDmController,
  pushDmEvent,
  removeDmController,
} from "./dm-registry"

function makeController() {
  const enqueued: Uint8Array[] = []
  return {
    enqueue: (v: Uint8Array) => enqueued.push(v),
    close: () => {},
    _enqueued: enqueued,
  }
}

afterEach(() => {
  _resetForTest()
})

describe("addDmController", () => {
  it("처음 추가 시 registry에 등록됨", () => {
    const c = makeController()
    addDmController("ig1", c as unknown as ReadableStreamDefaultController<Uint8Array>)
    expect(_registrySize()).toBe(1)
    expect(_controllerCount("ig1")).toBe(1)
  })

  it("동일 igUserId에 복수 controller 등록 가능", () => {
    const c1 = makeController()
    const c2 = makeController()
    addDmController("ig1", c1 as unknown as ReadableStreamDefaultController<Uint8Array>)
    addDmController("ig1", c2 as unknown as ReadableStreamDefaultController<Uint8Array>)
    expect(_registrySize()).toBe(1)
    expect(_controllerCount("ig1")).toBe(2)
  })
})

describe("removeDmController", () => {
  it("controller 제거 후 count 감소", () => {
    const c = makeController() as unknown as ReadableStreamDefaultController<Uint8Array>
    addDmController("ig1", c)
    removeDmController("ig1", c)
    expect(_controllerCount("ig1")).toBe(0)
    expect(_registrySize()).toBe(0)
  })

  it("복수 중 하나만 제거", () => {
    const c1 = makeController() as unknown as ReadableStreamDefaultController<Uint8Array>
    const c2 = makeController() as unknown as ReadableStreamDefaultController<Uint8Array>
    addDmController("ig1", c1)
    addDmController("ig1", c2)
    removeDmController("ig1", c1)
    expect(_controllerCount("ig1")).toBe(1)
  })

  it("존재하지 않는 igUserId 제거 시 에러 없음", () => {
    const c = makeController() as unknown as ReadableStreamDefaultController<Uint8Array>
    expect(() => removeDmController("nonexistent", c)).not.toThrow()
  })
})

describe("pushDmEvent", () => {
  it("연결된 controller에 이벤트 전달", () => {
    const c = makeController()
    addDmController("ig1", c as unknown as ReadableStreamDefaultController<Uint8Array>)
    pushDmEvent("ig1", { type: "dm_new_message", conversationId: "c1" })
    expect(c._enqueued).toHaveLength(1)
    const text = new TextDecoder().decode(c._enqueued[0])
    expect(text).toContain('"type":"dm_new_message"')
    expect(text).toMatch(/^data: /)
    expect(text).toMatch(/\n\n$/)
  })

  it("복수 controller 모두 수신", () => {
    const c1 = makeController()
    const c2 = makeController()
    addDmController("ig1", c1 as unknown as ReadableStreamDefaultController<Uint8Array>)
    addDmController("ig1", c2 as unknown as ReadableStreamDefaultController<Uint8Array>)
    pushDmEvent("ig1", { type: "dm_new_message" })
    expect(c1._enqueued).toHaveLength(1)
    expect(c2._enqueued).toHaveLength(1)
  })

  it("존재하지 않는 igUserId push 시 에러 없음", () => {
    expect(() => pushDmEvent("nobody", { type: "dm_new_message" })).not.toThrow()
  })
})
