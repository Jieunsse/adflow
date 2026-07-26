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
  it("쓰기가 실패하면 lastError 로 드러나요", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");
    useStore.getState().add({ id: "a", v: 1 });
    await vi.waitFor(() => expect(useStore.getState().lastError).toBeTruthy());
    // 로컬 값은 그대로 남는다 — 저장은 실패해도 사용자가 쓴 내용을 지우지 않는다.
    expect(useStore.getState().items).toHaveLength(1);
  });

  it("네트워크가 끊겨도 lastError 로 드러나요", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");
    useStore.getState().removeById("a");
    await vi.waitFor(() => expect(useStore.getState().lastError).toBeTruthy());
  });

  it("다음 쓰기가 성공하면 lastError 가 비워져요", async () => {
    const { useStore } = freshStore();
    await useStore.getState().hydrate("real@x.com");

    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    useStore.getState().add({ id: "a", v: 1 });
    await vi.waitFor(() => expect(useStore.getState().lastError).toBeTruthy());

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    useStore.getState().add({ id: "b", v: 2 });
    await vi.waitFor(() => expect(useStore.getState().lastError).toBeNull());
  });

  it("게스트는 쓰기를 단락하므로 에러도 안 생겨요", async () => {
    const { useStore } = freshStore();
    await useStore.getState().hydrate("guest@adflow.local");
    useStore.getState().add({ id: "a", v: 1 });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useStore.getState().lastError).toBeNull();
  });
  it("idOf 로 id 가 아닌 키를 쓸 수 있어요", async () => {
    interface KeyedItem {
      campaignId: string;
      enabled: boolean;
    }
    const { useStore } = createSyncedStore<KeyedItem>({
      name: "test_keyed_" + Math.random().toString(36).slice(2),
      endpoint: "/api/test-keyed",
      idOf: (i) => i.campaignId,
    });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await useStore.getState().hydrate("real@x.com");

    useStore.getState().add({ campaignId: "c1", enabled: true });
    useStore.getState().add({ campaignId: "c1", enabled: false });
    // 같은 campaignId 는 중복되지 않고 교체돼야 한다.
    expect(useStore.getState().items).toHaveLength(1);
    expect(useStore.getState().items[0].enabled).toBe(false);

    useStore.getState().removeById("c1");
    expect(useStore.getState().items).toHaveLength(0);
    // DELETE 쿼리도 campaignId 로 나가야 한다.
    const deleteCall = fetchMock.mock.calls.find((c) => c[1]?.method === "DELETE");
    expect(deleteCall?.[0]).toBe("/api/test-keyed?id=c1");
  });

  it("persist 캐시가 비면 migrate 로 레거시 데이터를 한 번 흡수해요", () => {
    const migrate = vi.fn(() => [{ id: "legacy1", v: 9 }]);
    const { useStore, rehydrate } = createSyncedStore<TItem>({
      name: "test_migrate_" + Math.random().toString(36).slice(2),
      endpoint: "/api/test",
      migrate,
    });
    rehydrate();
    expect(migrate).toHaveBeenCalledTimes(1);
    expect(useStore.getState().items).toEqual([{ id: "legacy1", v: 9 }]);

    // 두 번째 rehydrate 에서는 캐시가 차 있으므로 다시 흡수하지 않는다.
    rehydrate();
    expect(migrate).toHaveBeenCalledTimes(1);
  });

  it("snapshot 은 워밍된 items 를 동기로 돌려줘요", () => {
    const { useStore, snapshot } = createSyncedStore<TItem>({
      name: "test_snapshot_" + Math.random().toString(36).slice(2),
      endpoint: "/api/test",
    });
    // snapshot 은 SSR 가드로 window 를 본다. 이 케이스에서만 스텁하고 되돌린다 —
    // 파일 전역에 window 를 넣으면 zustand persist 의 분기가 바뀌어 다른 테스트가 흔들린다.
    vi.stubGlobal("window", {});
    try {
      expect(snapshot()).toEqual([]);
      useStore.getState().setAll([{ id: "a", v: 1 }]);
      expect(snapshot()).toEqual([{ id: "a", v: 1 }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
