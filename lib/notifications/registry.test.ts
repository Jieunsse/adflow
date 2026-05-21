import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _fanOutForTest,
  _registrySize,
  _resetForTest,
  _userControllerCount,
  addController,
  removeController,
} from "./registry";

const fetchMock = vi.fn();

interface FakeController {
  enqueue: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function makeController(): FakeController {
  return { enqueue: vi.fn(), close: vi.fn() };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  vi.stubGlobal("fetch", fetchMock);
  _resetForTest();
});

afterEach(() => {
  _resetForTest();
  vi.unstubAllGlobals();
});

describe("registry — add/remove", () => {
  it("새 user 추가 = registrySize 1, controllerCount 1", () => {
    const c = makeController();
    const r = addController("u1", "tok", "act_1", c as unknown as ReadableStreamDefaultController<Uint8Array>);
    expect(r.added).toBe(true);
    expect(_registrySize()).toBe(1);
    expect(_userControllerCount("u1")).toBe(1);
  });

  it("같은 user 두 controller = 1 user / 2 controller", () => {
    addController("u1", "tok", "act_1", makeController() as unknown as ReadableStreamDefaultController<Uint8Array>);
    addController("u1", "tok", "act_1", makeController() as unknown as ReadableStreamDefaultController<Uint8Array>);
    expect(_registrySize()).toBe(1);
    expect(_userControllerCount("u1")).toBe(2);
  });

  it("removeController 마지막 = registry 에서 user 삭제", () => {
    const c = makeController();
    addController("u1", "tok", "act_1", c as unknown as ReadableStreamDefaultController<Uint8Array>);
    removeController("u1", c as unknown as ReadableStreamDefaultController<Uint8Array>);
    expect(_registrySize()).toBe(0);
  });
});

describe("registry — cap", () => {
  it("user controller cap 초과 시 가장 오래된 close (LRU)", () => {
    const controllers = Array.from({ length: 11 }, () => makeController());
    for (const c of controllers) {
      addController("u1", "tok", "act_1", c as unknown as ReadableStreamDefaultController<Uint8Array>);
    }
    expect(_userControllerCount("u1")).toBe(10);
    expect(controllers[0].close).toHaveBeenCalled();
    expect(controllers[10].close).not.toHaveBeenCalled();
  });

  it("global user cap 초과 시 added=false 반환", () => {
    for (let i = 0; i < 500; i++) {
      addController(`u${i}`, "tok", "act_1", makeController() as unknown as ReadableStreamDefaultController<Uint8Array>);
    }
    const overflowController = makeController();
    const r = addController("u500", "tok", "act_1", overflowController as unknown as ReadableStreamDefaultController<Uint8Array>);
    expect(r.added).toBe(false);
    expect(r.reason).toBe("global_cap");
    expect(_registrySize()).toBe(500);
  });
});

describe("registry — fan-out", () => {
  it("한 user 의 모든 controller 에 같은 메시지 전송", () => {
    const c1 = makeController();
    const c2 = makeController();
    addController("u1", "tok", "act_1", c1 as unknown as ReadableStreamDefaultController<Uint8Array>);
    addController("u1", "tok", "act_1", c2 as unknown as ReadableStreamDefaultController<Uint8Array>);
    _fanOutForTest("u1", { type: "auth_expired" });
    expect(c1.enqueue).toHaveBeenCalled();
    expect(c2.enqueue).toHaveBeenCalled();
    const c1Chunk = c1.enqueue.mock.calls[0][0] as Uint8Array;
    const c2Chunk = c2.enqueue.mock.calls[0][0] as Uint8Array;
    expect(new TextDecoder().decode(c1Chunk)).toContain("auth_expired");
    expect(new TextDecoder().decode(c2Chunk)).toContain("auth_expired");
  });

  it("enqueue 실패한 controller 는 자동 제거", () => {
    const good = makeController();
    const bad = makeController();
    bad.enqueue.mockImplementation(() => {
      throw new Error("closed");
    });
    addController("u1", "tok", "act_1", good as unknown as ReadableStreamDefaultController<Uint8Array>);
    addController("u1", "tok", "act_1", bad as unknown as ReadableStreamDefaultController<Uint8Array>);
    _fanOutForTest("u1", { type: "auth_expired" });
    expect(_userControllerCount("u1")).toBe(1);
  });
});
