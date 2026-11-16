package ai.adflow.api.store.campaign;

/**
 * TS: CampaignStage. 상수명이 곧 와이어 값이라 소문자로 쓴다.
 *
 * 선언 순서가 TS 의 STAGE_ORDER 와 같다 — 화면 표기(후보·제안함·…)는 프론트가 갖는다.
 */
public enum CampaignStage {
  candidate,
  proposed,
  negotiating,
  producing,
  published,
  settled
}
