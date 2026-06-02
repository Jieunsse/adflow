import { beforeEach, describe, expect, it, vi } from "vitest";

// node 환경에 localStorage 없으므로 Map 기반 스텁 주입(persist 가 lazy 접근).
const ls = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => {
    ls.set(k, v);
  },
  removeItem: (k: string) => {
    ls.delete(k);
  },
  clear: () => {
    ls.clear();
  },
});

import { createSyncedStore } from "./createSyncedStore";

interface TItem {
  id: string;
  v: number;
}

// 매 테스트 새 persist 키 → 캐시 격리.
function freshStore() {
  return createSyncedStore<TItem>({
    name: "test_synced_" + Math.random().toString(36).slice(2),
    endpoint: "/api/test",
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  ls.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("createSyncedStore", () => {
  it("게스트 하이드레이션 = fetch 단락, ready", async () => {
    const { useStore } = freshStore();
    await useStore.getState().hydrate("guest@adflow.local");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useStore.getState().status).toBe("ready");
  });

  it("미로그인(null) 하이드레이션 = fetch 단락, ready", async () => {
    const { useStore } = freshStore();
    await useStore.getState().hydrate(null);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useStore.getState().status).toBe("ready");
  });

  it("실유저 하이드레이션 = GET 으로 items 교체", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: "a", v: 1 }] }) });
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");
    expect(fetchMock).toHaveBeenCalledWith("/api/test", { headers: { accept: "application/json" } });
    expect(useStore.getState().items).toEqual([{ id: "a", v: 1 }]);
    expect(useStore.getState().status).toBe("ready");
  });

  it("하이드레이션 네트워크 실패 → persist 캐시 유지, ready", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { useStore } = freshStore();
    useStore.getState().setAll([{ id: "cached", v: 9 }]);
    await useStore.getState().hydrate("real@x.com");
    expect(useStore.getState().items).toEqual([{ id: "cached", v: 9 }]);
    expect(useStore.getState().status).toBe("ready");
  });

  it("실유저 add = optimistic prepend + POST", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");
    fetchMock.mockClear();
    useStore.getState().add({ id: "n1", v: 5 });
    expect(useStore.getState().items[0]).toEqual({ id: "n1", v: 5 });
    expect(fetchMock).toHaveBeenCalledWith("/api/test", expect.objectContaining({ method: "POST" }));
  });

  it("게스트 add = 로컬만, fetch 없음", async () => {
    const { useStore } = freshStore();
    await useStore.getState().hydrate("guest@adflow.local");
    fetchMock.mockClear();
    useStore.getState().add({ id: "g1", v: 1 });
    expect(useStore.getState().items[0]).toEqual({ id: "g1", v: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("실유저 removeById = 로컬 제거 + DELETE", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: "a", v: 1 }] }) });
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");
    fetchMock.mockClear();
    useStore.getState().removeById("a");
    expect(useStore.getState().items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith("/api/test?id=a", { method: "DELETE" });
  });

  it("add 는 같은 id 중복 제거 후 prepend", () => {
    const { useStore } = freshStore();
    useStore.getState().setAll([
      { id: "a", v: 1 },
      { id: "b", v: 2 },
    ]);
    useStore.getState().add({ id: "a", v: 99 });
    expect(useStore.getState().items).toEqual([
      { id: "a", v: 99 },
      { id: "b", v: 2 },
    ]);
  });

  it("upsert 는 기존 id 를 제자리 교체(순서 보존)", () => {
    const { useStore } = freshStore();
    useStore.getState().setAll([
      { id: "a", v: 1 },
      { id: "b", v: 2 },
    ]);
    useStore.getState().upsert({ id: "a", v: 99 });
    expect(useStore.getState().items).toEqual([
      { id: "a", v: 99 },
      { id: "b", v: 2 },
    ]);
  });

  it("upsert 는 새 id 를 prepend", () => {
    const { useStore } = freshStore();
    useStore.getState().setAll([{ id: "b", v: 2 }]);
    useStore.getState().upsert({ id: "a", v: 1 });
    expect(useStore.getState().items).toEqual([
      { id: "a", v: 1 },
      { id: "b", v: 2 },
    ]);
  });

  it("실유저 upsert = POST", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");
    fetchMock.mockClear();
    useStore.getState().upsert({ id: "u1", v: 5 });
    expect(fetchMock).toHaveBeenCalledWith("/api/test", expect.objectContaining({ method: "POST" }));
  });
});
