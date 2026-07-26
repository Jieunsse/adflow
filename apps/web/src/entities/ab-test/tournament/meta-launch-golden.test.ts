// 골든 픽스처 — 게재 요청 바디를 잠근다 (단계 6).
//
// Meta 게재는 실 계정 없이는 검증할 수 없다. TS 클라이언트는 실전에서 검증됐지만 Java 재작성본은
// 아무도 돌려볼 수 없다 — 설계가 이 조각을 "최고 위험"으로 꼽은 이유다. 그래서 단계 5 와 같은
// 처방을 쓴다: **TS 가 실제로 보내는 요청을 파일로 떠서 양쪽이 같은 파일을 읽는다.**
//
// 기대값은 손으로 적은 게 아니라 이 클라이언트에서 떠낸 것이다. 역할은 "정답 증명"이 아니라 잠금이다.
// 게재 규칙을 의도적으로 바꿨다면 픽스처를 다시 떠야 하고, 그때 Java 도 같이 깨진다.
//
// 대응 Java: apps/api/src/test/java/ai/adflow/api/meta/MetaLaunchGoldenTest.java

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMetaRoundLauncher } from "./meta-launcher";
import type { Tournament, TourRound } from "./engine";

type Case = {
  name: string;
  input: { tournament: Tournament; round: TourRound };
  requests: Array<{ path: string; body: Record<string, unknown> }>;
  result: { campaignId: string; adIds: [string, string]; adSetIds: [string, string]; studyId: string };
};

const FIXTURE = join(__dirname, "../../../../../../packages/contracts/fixtures/meta/split-test-launch.json");
const { splitTestLaunch } = JSON.parse(readFileSync(FIXTURE, "utf8")) as { splitTestLaunch: Case[] };

const fetchMock = vi.fn();

function pathSegment(url: string): string {
  return /\/([^/?]+)(?:\?|$)/.exec(url)?.[1] ?? "";
}

beforeEach(() => {
  fetchMock.mockReset();
  // start_time·end_time 이 오늘에서 파생된다 — 픽스처를 뜬 시각에 고정하지 않으면 매일 깨진다.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-26T03:00:00Z"));
  const counters: Record<string, number> = {};
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "DELETE") return { ok: true, json: async () => ({ success: true }) };
    const seg = pathSegment(url);
    counters[seg] = (counters[seg] ?? 0) + 1;
    if (seg === "adimages") {
      return { ok: true, json: async () => ({ images: { f: { hash: "img_hash_1", url: "x" } } }) };
    }
    const id: Record<string, string> = {
      campaigns: "camp_1",
      adsets: `adset_${counters[seg]}`,
      adcreatives: `creative_${counters[seg]}`,
      ads: `ad_${counters[seg]}`,
      ad_studies: "study_1",
    };
    return { ok: true, json: async () => ({ id: id[seg] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("split test 게재 요청 골든 픽스처", () => {
  it("케이스가 비어 있지 않다", () => {
    // 픽스처가 비면 아래 테스트가 전부 vacuously pass 한다.
    expect(splitTestLaunch.length).toBeGreaterThanOrEqual(5);
  });

  for (const c of splitTestLaunch) {
    it(c.name, async () => {
      const result = await createMetaRoundLauncher().launch(c.input.tournament, c.input.round);

      const sent = fetchMock.mock.calls
        .filter((call) => (call[1] as RequestInit)?.method === "POST")
        .map((call) => {
          const body = JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>;
          delete body.access_token;
          return { path: pathSegment(call[0] as string), body };
        });

      // 호출 순서도 계약이다 — 셀 A 를 만들고 나서 B, 그 다음 ad_studies 여야 한다.
      expect(sent.map((s) => s.path)).toEqual(c.requests.map((r) => r.path));
      expect(sent).toEqual(c.requests);
      expect(result).toEqual(c.result);
    });
  }
});
