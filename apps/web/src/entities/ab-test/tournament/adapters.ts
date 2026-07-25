// ADR-038 결정 6 — 데모/실제 공존의 이음매. 순수 엔진(engine.ts)은 양쪽 공유, 갈라지는 건 어댑터 3개뿐.
// 데모 = localStorage store + 시뮬 게재 + 시드 KPI / 실제 = Supabase store + Meta ad study + Meta insights.
// 전부 async — 실 토너먼트는 며칠에 걸쳐 서버 폴러가 브라우저 없이 진행하므로 Supabase 가 진실의 원천.
// 섬1: 인터페이스 + SupabaseTournamentStore 구현. RoundLauncher·KpiSource 의 Meta 구현·UI 배선은 섬2.

import type { AdKpi } from "@entities/insights/ab-verdict";
import type { Tournament, TourRound, RoundVerdict } from "./engine";

// 영속화 (ADR-038 결정 2) — 서버 cron 폴러와 클라 UI 양쪽이 읽고 쓴다. 데모는 localStorage 동기 함수 유지.
// list() = cron 전역 스캔, listByOwner() = API 라우트가 세션 유저 소유분만 조회(user_email 매칭).
export interface TournamentStore {
  list(): Promise<Tournament[]>;
  listByOwner(ownerKey: string): Promise<Tournament[]>;
  // ADR-047 — Hypothesis Ledger 투영 입력. 소유 유저의 같은 Brand Profile 토너먼트만(resolved 가설 평탄화 대상).
  listByBrandOwner(brandProfileId: string, ownerKey: string): Promise<Tournament[]>;
  get(id: string): Promise<Tournament | null>;
  upsert(t: Tournament): Promise<void>;
  remove(id: string): Promise<void>;
}

// 라운드 게재 (ADR-038 결정 4) — 데모=결정적 campaignId 시뮬, 실제=ad_studies SPLIT_TEST.
// 실제는 셀 A(챔피언)·B(챌린저)를 각각 독립 AdSet 으로 만들고 ad study 가 청중을 50/50 분할한다.
// adIds=셀별 insights 키, adSetIds=셀 AdSet, studyId=Meta verdict 조회 키. 데모는 campaignId 만 반환.
export interface RoundLauncher {
  launch(
    t: Tournament,
    round: TourRound,
  ): Promise<{ campaignId: string; adIds?: [string, string]; adSetIds?: [string, string]; studyId?: string }>;
}

// KPI 소스 (ADR-038 결정 1) — 데모=시드 결정적 생성기(roundAdKpis), 실제=Meta insights 폴링.
// roundVerdict (ADR §4 정석) — 실제는 ad study 의 Meta 유의성 결과를 verdict 로 채택한다.
// 스터디 미확정(진행 중)이면 null → cron 이 결산을 보류하고 다음 폴에서 재시도. 데모는 미구현(z-검정 폴백).
export interface KpiSource {
  roundKpis(t: Tournament, round: TourRound): Promise<[AdKpi, AdKpi]>;
  roundVerdict?(
    t: Tournament,
    round: TourRound,
    kpis: [AdKpi, AdKpi],
  ): Promise<{ verdict: RoundVerdict; winner: "A" | "B" } | null>;
}
