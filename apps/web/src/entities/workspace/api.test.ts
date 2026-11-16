import { describe, expect, it, vi } from "vitest";
import { fetchAccount, fetchPickerList, fetchWorkspaceTarget } from "./api";

const ls = new Map<string, string>();
function stubBrowser() {
  vi.stubGlobal("window", { dispatchEvent: () => true });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => ls.get(k) ?? null,
    setItem: (k: string, v: string) => { ls.set(k, v); },
    removeItem: (k: string) => { ls.delete(k); },
    clear: () => { ls.clear(); },
  });
}

describe("workspace API", () => {
  it("연결 대상은 지금 고른 브랜드의 연결이다", async () => {
    stubBrowser();
    localStorage.setItem("adflow:brand-profile:active-id", "bp_1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ adAccountId: "act_1", pageId: "pg_1" }),
    }));

    await expect(fetchWorkspaceTarget()).resolves.toEqual({
      target: { adAccountId: "act_1", pageId: "pg_1" },
      lastChange: null,
    });
    expect(fetch).toHaveBeenCalledWith("/api/brands/bp_1");
    vi.unstubAllGlobals();
    ls.clear();
  });

  it("계정 인증 만료를 401 code로 전달한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "다시 로그인해주세요." }),
    }));

    await expect(fetchAccount()).rejects.toMatchObject({ code: 401, message: "다시 로그인해주세요." });
    vi.unstubAllGlobals();
  });

  it("광고 계정 picker 응답을 화면 모델로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accounts: [{ id: "act_1", name: "AdFlow", currency: "KRW", account_status: 1 }] }),
    }));

    await expect(fetchPickerList("account")).resolves.toEqual([
      { id: "act_1", name: "AdFlow", currency: "KRW", status: "active" },
    ]);
    expect(fetch).toHaveBeenCalledWith("/api/setup/ad-accounts");
    vi.unstubAllGlobals();
  });
});
