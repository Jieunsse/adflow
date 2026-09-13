import { afterEach, describe, expect, it, vi } from "vitest";
import { controlCampaign, updateCampaignAdSet } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("campaign api", () => {
  it("캠페인 제어 요청을 공통 endpoint로 보낸다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: "PAUSED" }), { status: 200 }),
    ));

    await controlCampaign({ campaignId: "c1", action: "pause" });

    expect(fetch).toHaveBeenCalledWith("/api/campaign/control", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ campaignId: "c1", action: "pause" }),
    }));
  });

  it("캠페인 설정 수정 오류를 일관된 예외로 변환한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "권한이 없어요" }), { status: 403 }),
    ));

    await expect(updateCampaignAdSet("c1", { dailyBudget: 10000 })).rejects.toThrow("권한이 없어요");
  });
});
