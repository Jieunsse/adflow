import { describe, expect, it, vi } from "vitest";
import { fetchAccount, fetchPickerList, fetchWorkspaceTarget } from "./api";

describe("workspace API", () => {
  it("워크스페이스 연결 대상을 읽는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ target: { adAccountId: "act_1" }, lastChange: null }),
    }));

    await expect(fetchWorkspaceTarget()).resolves.toEqual({
      target: { adAccountId: "act_1" },
      lastChange: null,
    });
    expect(fetch).toHaveBeenCalledWith("/api/workspace/meta-target");
    vi.unstubAllGlobals();
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
