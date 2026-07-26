import { beforeEach, describe, expect, it, vi } from "vitest";

// node 환경에 localStorage 없으므로 Map 기반 스텁 주입
const store = new Map<string, string>();
vi.stubGlobal("window", {});
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
});

import {
  absorbLegacyPersonas,
  personas,
  readPersonas,
  removePersonasForProfile,
} from "./usePersonasStorage";

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

// 단계 3 승격 이후 readPersonas 는 localStorage 가 아니라 store 스냅샷을 읽는다.
// 헬퍼가 그 자리를 대신한다 — 검증 대상(readPersonas 의 동기 시그니처·필터링)은 그대로다.
function setStorage(items: object[]) {
  personas.useStore.getState().setAll(items as never[]);
}

beforeEach(() => {
  store.clear();
  personas.useStore.getState().setAll([]);
});

describe("readPersonas", () => {
  it("빈 스토리지에서 빈 배열 반환", () => {
    expect(readPersonas()).toEqual([]);
  });

  it("저장된 항목 반환", () => {
    setStorage([p1, p2]);
    expect(readPersonas()).toHaveLength(2);
  });

  it("손상된 레거시 JSON 은 흡수에서 걸러져요", () => {
    localStorage.setItem(LS_KEY, "not-json");
    expect(absorbLegacyPersonas()).toEqual([]);
    expect(readPersonas()).toEqual([]);
  });
});

// 승격 이후 뮤테이션은 store 를 거친다. localStorage 를 흉내내는 대신 실제 경로를 친다.
// owner 가 null 이라 서버 호출은 단락된다(게스트/미로그인 동작).
describe("savePersona / deletePersona", () => {
  it("신규 Persona 저장", () => {
    personas.useStore.getState().upsert(p1 as never);
    expect(readPersonas()).toHaveLength(1);
    expect(readPersonas()[0].id).toBe("p1");
  });

  it("기존 Persona 업데이트 — 자리를 지킨 채 교체돼요", () => {
    setStorage([p1, p2]);
    personas.useStore.getState().upsert({ ...p1, name: "업데이트됨" } as never);
    expect(readPersonas()).toHaveLength(2);
    expect(readPersonas()[0].name).toBe("업데이트됨");
  });

  it("Persona 삭제", () => {
    setStorage([p1, p2]);
    personas.useStore.getState().removeById("p1");
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

describe("personas store 승격", () => {
  it("레거시 배열 키를 흡수하고 지워요", () => {
    localStorage.setItem(
      "adflow:personas",
      JSON.stringify([{ id: "p1", brandProfileId: "bp1", name: "레거시" }]),
    );

    const absorbed = absorbLegacyPersonas();

    expect(absorbed).toHaveLength(1);
    expect(absorbed[0].name).toBe("레거시");
    expect(localStorage.getItem("adflow:personas")).toBeNull();
  });

  it("레거시가 없으면 빈 배열이에요", () => {
    expect(absorbLegacyPersonas()).toEqual([]);
  });

  it("removePersonasForProfile 이 해당 프로필의 페르소나만 지워요", () => {
    personas.useStore.getState().setAll([
      { id: "p1", brandProfileId: "bp1", name: "A" },
      { id: "p2", brandProfileId: "bp2", name: "B" },
      { id: "p3", brandProfileId: "bp1", name: "C" },
    ]);

    removePersonasForProfile("bp1");

    expect(readPersonas().map((p) => p.id)).toEqual(["p2"]);
  });
});
