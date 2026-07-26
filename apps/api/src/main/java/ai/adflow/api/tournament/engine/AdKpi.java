package ai.adflow.api.tournament.engine;

/**
 * 광고 1개의 4필드 성과. TS: apps/web/src/entities/insights/ab-verdict 의 AdKpi.
 *
 * <p>ctr 은 퍼센트값(1.8 = 1.8%)이다. 비율이 아니다 — TS 와 같은 단위를 쓴다.
 */
public record AdKpi(int impressions, int clicks, double ctr, double spend) {

  public static final AdKpi EMPTY = new AdKpi(0, 0, 0, 0);

  /** CPM(노출 천 회당 비용). awareness 목표의 결정 지표다. */
  public double cpm() {
    return impressions > 0 ? (spend / impressions) * 1000 : 0;
  }
}
