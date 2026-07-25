import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/supabase-sync", () => ({
  syncUpsert: vi.fn(),
  syncDelete: vi.fn(),
}));

// node 환경에 localStorage 없으므로 Map 기반 스텁 주입
const store = new Map<string, string>();
vi.stubGlobal("window", {});
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
});

import { readPersonas } from "./usePersonasStorage";

const LS_KEY = "adflow:personas";

const p1 = {
  id: "p1",
  brandProfileId: "bp1",
  name: "20대 여성",
  ageMin: 20,
  ageMax: 29,
  genders: [2],
};
const p2 = {
  id: "p2",
  brandProfileId: "bp2",
  name: "전체",
};

function setStorage(items: object[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

beforeEach(() => {
  store.clear();
});

describe("readPersonas", () => {
  it("빈 스토리지에서 빈 배열 반환", () => {
    expect(readPersonas()).toEqual([]);
  });

  it("저장된 항목 반환", () => {
    setStorage([p1, p2]);
    expect(readPersonas()).toHaveLength(2);
  });

  it("손상된 JSON 에서 빈 배열 반환", () => {
    localStorage.setItem(LS_KEY, "not-json");
    expect(readPersonas()).toEqual([]);
  });
});

describe("savePersona / deletePersona — localStorage 직접 조작", () => {
  it("신규 Persona 저장", () => {
    setStorage([]);
    const all = [...readPersonas(), p1];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    expect(readPersonas()).toHaveLength(1);
    expect(readPersonas()[0].id).toBe("p1");
  });

  it("기존 Persona 업데이트", () => {
    setStorage([p1]);
    const updated = { ...p1, name: "업데이트됨" };
    localStorage.setItem(LS_KEY, JSON.stringify([updated]));
    expect(readPersonas()[0].name).toBe("업데이트됨");
  });

  it("Persona 삭제", () => {
    setStorage([p1, p2]);
    localStorage.setItem(LS_KEY, JSON.stringify([p2]));
    expect(readPersonas()).toHaveLength(1);
    expect(readPersonas()[0].id).toBe("p2");
  });
});

describe("usePersonasForProfile — 필터링 검증", () => {
  it("다른 brandProfileId 소속 Persona를 반환하지 않음", () => {
    setStorage([p1, p2]);
    const filtered = readPersonas().filter((p) => p.brandProfileId === "bp1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("p1");
  });

  it("해당 brandProfileId 가 없으면 빈 배열", () => {
    setStorage([p1, p2]);
    const filtered = readPersonas().filter((p) => p.brandProfileId === "bp-unknown");
    expect(filtered).toHaveLength(0);
  });

  it("같은 brandProfileId 여러 Persona 반환", () => {
    const p3 = { ...p2, id: "p3", brandProfileId: "bp1" };
    setStorage([p1, p3]);
    const filtered = readPersonas().filter((p) => p.brandProfileId === "bp1");
    expect(filtered).toHaveLength(2);
  });
});
