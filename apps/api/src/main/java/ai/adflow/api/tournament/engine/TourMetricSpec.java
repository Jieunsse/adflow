package ai.adflow.api.tournament.engine;

import java.util.Map;

/**
 * 목표별 결정 지표 (ADR-037 V2). TS: objective-metric.ts 의 TourMetricSpec.
 *
 * <p>rate 목표(traffic·engagement·leads_call)는 action 비율이 높을수록 우세, cpm 목표(awareness)는
 * CPM 이 낮을수록 우세다. 이 분기를 여기 한 곳에 모아 엔진·판정이 공유한다.
 *
 * <p>라벨은 TS 와 값이 같아야 한다 — 골든 픽스처가 문자열까지 비교한다.
 */
public record TourMetricSpec(
    String id,
    String kind,
    String rateLabel,
    double seedDefault,
    boolean higherBetter,
    double leadEpsilon) {

  public static final String RATE = "rate";
  public static final String CPM = "cpm";

  private static final TourMetricSpec TRAFFIC =
      new TourMetricSpec("traffic", RATE, "CTR", 1.8, true, 0.01);

  private static final Map<String, TourMetricSpec> SPECS =
      Map.of(
          "traffic", TRAFFIC,
          "awareness", new TourMetricSpec("awareness", CPM, "CPM", 8000, false, 30),
          "engagement", new TourMetricSpec("engagement", RATE, "참여율", 1.8, true, 0.01),
          "leads_call", new TourMetricSpec("leads_call", RATE, "통화율", 1.8, true, 0.01));

  /** 알 수 없는 목표는 traffic 으로 폴백한다 — TS 의 `SPECS[objective] ?? SPECS.traffic`. */
  public static TourMetricSpec of(String objective) {
    if (objective == null) return TRAFFIC;
    return SPECS.getOrDefault(objective, TRAFFIC);
  }

  public boolean isCpm() {
    return CPM.equals(kind);
  }
}
