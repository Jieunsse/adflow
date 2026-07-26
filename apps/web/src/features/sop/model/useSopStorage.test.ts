import { beforeEach, describe, expect, it, vi } from "vitest";

// node 환경에 localStorage 없으므로 Map 기반 스텁 주입(usePersonasStorage.test.ts 패턴).
const ls = new Map<string, string>();
vi.stubGlobal("window", {});
vi.stubGlobal("localStorage", {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => { ls.set(k, v); },
  removeItem: (k: string) => { ls.delete(k); },
  clear: () => { ls.clear(); },
  get length() { return ls.size; },
  key: (i: number) => [...ls.keys()][i] ?? null,
});

import { absorbLegacySops, sops } from "./useSopStorage";

const fetchMock = vi.fn();

beforeEach(() => {
  ls.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  sops.useStore.getState().setAll([]);
});

function legacySop(id: string, name: string) {
  return {
    id,
    name,
    sections: [{ type: "prohibited_words", data: { words: ["최저가"] } }],
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };
}

describe("absorbLegacySops", () => {
  it("인덱스와 개별 키에서 SOP 을 건져 올려요", () => {
    ls.set("adflow:sop:version", "2");
    ls.set("adflow:sop-index", JSON.stringify(["s1", "s2"]));
    ls.set("adflow:sop:s1", JSON.stringify(legacySop("s1", "정책1")));
    ls.set("adflow:sop:s2", JSON.stringify(legacySop("s2", "정책2")));

    const absorbed = absorbLegacySops();

    expect(absorbed.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(absorbed[0].name).toBe("정책1");
    // 흡수 후 레거시 키는 지워져야 한다 — 남으면 다음 로그인에서 다시 올라온다.
    expect(ls.has("adflow:sop-index")).toBe(false);
    expect(ls.has("adflow:sop:s1")).toBe(false);
  });

  it("인덱스에 있지만 본문이 없는 id 는 건너뛰어요", () => {
    ls.set("adflow:sop:version", "2");
    ls.set("adflow:sop-index", JSON.stringify(["s1", "ghost"]));
    ls.set("adflow:sop:s1", JSON.stringify(legacySop("s1", "정책1")));

    expect(absorbLegacySops().map((s) => s.id)).toEqual(["s1"]);
  });

  it("레거시 데이터가 없으면 빈 배열이에요", () => {
    expect(absorbLegacySops()).toEqual([]);
  });

  it("버전이 낮으면 폐기하고 아무것도 흡수하지 않아요", () => {
    // ADR-020 의 v0.6 리셋. 옛 모양(content: string)이 서버로 올라가면 안 된다.
    ls.set("adflow:sop:version", "1");
    ls.set("adflow:sop-index", JSON.stringify(["old"]));
    ls.set("adflow:sop:old", JSON.stringify({ id: "old", content: "옛 모양" }));

    expect(absorbLegacySops()).toEqual([]);
    expect(ls.has("adflow:sop:old")).toBe(false);
    expect(ls.get("adflow:sop:version")).toBe("2");
  });
});

describe("sops store", () => {
  it("게스트는 서버를 호출하지 않아요", async () => {
    await sops.useStore.getState().hydrate("guest@adflow.local");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("실유저는 서버에서 하이드레이션해요", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [legacySop("s9", "서버")] }),
    });
    await sops.useStore.getState().hydrate("real@x.com");
    expect(fetchMock).toHaveBeenCalledWith("/api/stores/sops", {
      headers: { accept: "application/json" },
    });
    expect(sops.useStore.getState().items[0].name).toBe("서버");
  });
});
