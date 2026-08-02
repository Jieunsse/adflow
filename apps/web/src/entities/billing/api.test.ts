import { describe, expect, it, vi } from "vitest";
import { fetchBilling } from "./api";

const billing = {
  accountId: "act_1", accountName: "AdFlow", currency: "KRW", accountStatus: 1,
  balance: 0, spendCap: null, amountSpent: 0, fundingSources: [],
  business: { name: null, street: null, city: null, state: null, zip: null, countryCode: null },
};

describe("fetchBilling", () => {
  it("결제 정보를 읽는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => billing }));

    await expect(fetchBilling()).resolves.toEqual(billing);
    expect(fetch).toHaveBeenCalledWith("/api/billing");
    vi.unstubAllGlobals();
  });

  it("광고 계정 미연결은 401 code를 보존한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 401, json: async () => ({ error: "광고 계정을 먼저 연결해주세요." }),
    }));

    await expect(fetchBilling()).rejects.toMatchObject({ code: 401 });
    vi.unstubAllGlobals();
  });
});
