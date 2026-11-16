package ai.adflow.api.tournament.engine;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * A/B 토너먼트 순수 엔진 (ADR-032/037/054/061). TS: engine.ts 의 결정 함수들.
 *
 * <p>부작용이 없다 — 영속화·게재·KPI 조회는 전부 바깥이다. 그래야 골든 픽스처로 TS 와 1:1 대조가 된다.
 *
 * <p><b>왜 이중화하나:</b> 둘러보기는 백엔드 없이 돌아야 해서(설계 §7) TS 엔진이 남는다. 이 클래스는
 * 실사용 판정을 소유한다. 두 엔진이 갈라지면 같은 광고에 다른 판정이 나오므로 골든 픽스처가 CI 에서
 * 막는다.
 */
public final class TourEngine {

  private TourEngine() {}

  /** 자동 순회 축. image 는 셋업에서 유저가 고르는 라운드1 전용이라 제외한다. */
  private static final String[] AXIS_CYCLE = {"headline", "primary_text"};

  /** 광고당 일평균 노출 기준치 — 빨리감기 1주면 광고당 ≈ 1.5만 노출. */
  private static final int BASE_DAILY_IMP_PER_AD = 2200;

  /** winner 확정 신뢰도 임계 (ADR-037). 미만이면 inconclusive. */
  public static final double WINNER_CONFIDENCE = 0.9;

  /** 최소 게재 기간 (ADR-037 §6). 미달이면 결산 보류. */
  public static final int MIN_ROUND_DAYS = 4;

  /** 챔피언 N회 연속 방어 = 수렴 정지 기본 횟수 (ADR-061). */
  public static final int DEFAULT_DEFEND_STREAK = 2;

  /* ─── 결정성의 뿌리 ─────────────────────────────────────────── */

  /**
   * 같은 (seed, index)면 항상 같은 값. TS: seededUnit.
   *
   * <p>TS 는 `h = (h * 31 + charCodeAt(i)) | 0` 로 int32 로 접는다. Java 의 int 산술이 정확히 같은
   * wrap-around 라 캐스팅 없이 1:1 이다. <b>여기가 갈라지면 시드 KPI 전부가 갈라진다.</b>
   *
   * <p>charAt 은 UTF-16 코드 유닛을 준다 — TS 의 charCodeAt 과 같다. 서로게이트 페어(이모지)도
   * 코드 포인트가 아니라 유닛 2개로 도는 것까지 같아야 해서 codePointAt 을 쓰면 안 된다.
   */
  public static double seededUnit(String seed, int index) {
    int h = 0;
    for (int i = 0; i < seed.length(); i++) {
      h = h * 31 + seed.charAt(i);
    }
    h = h * 9301 + index * 49297 + 233280;
    return (((h % 10000) + 10000) % 10000) / 10000.0;
  }

  public static double seededUnit(String seed) {
    return seededUnit(seed, 0);
  }

  public static String roundCampaignId(String tournamentId, int index) {
    return "browse_tourn_" + tournamentId + "_r" + index;
  }

  public static String nextAxis(int cursor) {
    return AXIS_CYCLE[Math.floorMod(cursor, AXIS_CYCLE.length)];
  }

  /** 챔피언↔챌린저가 어느 필드에서 다른지로 라운드 축을 도출. */
  public static String deriveAxis(TourVariant champion, TourVariant challenger) {
    String a = champion.imageUrl() == null ? "" : champion.imageUrl();
    String b = challenger.imageUrl() == null ? "" : challenger.imageUrl();
    if (!a.equals(b)) return "image";
    if (!champion.headline().equals(challenger.headline())) return "headline";
    return "primary_text";
  }

  /* ─── 통계 ──────────────────────────────────────────────────── */

  /** 표준정규 CDF (Abramowitz & Stegun 26.2.17). TS 와 계수·연산 순서가 같아야 한다. */
  private static double stdNormalCdf(double z) {
    double b1 = 0.319381530,
        b2 = -0.356563782,
        b3 = 1.781477937,
        b4 = -1.821255978,
        b5 = 1.330274429;
    double p = 0.2316419, c = 0.39894228;
    double az = Math.abs(z);
    double t = 1 / (1 + p * az);
    double poly = ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;
    double upper = c * Math.exp((-az * az) / 2) * poly;
    return z >= 0 ? 1 - upper : upper;
  }

  /** 두 광고의 2-비율 z-검정 → 신뢰도 = Φ(|z|). */
  public static double confidenceFromZTest(AdKpi a, AdKpi b) {
    if (a.impressions() <= 0 || b.impressions() <= 0) return 0.5;
    double pa = (double) a.clicks() / a.impressions();
    double pb = (double) b.clicks() / b.impressions();
    double pooled = (double) (a.clicks() + b.clicks()) / (a.impressions() + b.impressions());
    double se =
        Math.sqrt(pooled * (1 - pooled) * (1.0 / a.impressions() + 1.0 / b.impressions()));
    if (se == 0) return 0.5;
    return stdNormalCdf(Math.abs(pa - pb) / se);
  }

  /**
   * 노출 볼륨 차의 유의도 (awareness CPM 판정용).
   *
   * <p>노출 수천 회면 raw z 가 포화해 항상 유의해진다 — 실 Meta CPM 일변동 분산을 반영하는 데모
   * 캘리브레이션 상수로 감쇠해 스프레드를 만든다.
   */
  private static final double COUNT_TEST_DAMP = 10;

  public static double confidenceFromCountTest(int impA, int impB) {
    if (impA <= 0 || impB <= 0) return 0.5;
    double se = Math.sqrt((double) impA + impB);
    if (se == 0) return 0.5;
    return stdNormalCdf(Math.abs((double) impB - impA) / (se * COUNT_TEST_DAMP));
  }

  /* ─── 판정 코어 ─────────────────────────────────────────────── */

  /**
   * KPI 두 셀 → verdict + 승격 (ADR-037). 데모(시드 KPI)와 실제(Meta insights)가 공유한다.
   *
   * <p>rate 목표는 <b>단가</b>(spend/clicks)가 낮은 쪽이 우세다 — 비율이 아니다. 클릭이 0이면 단가가
   * 무한대라 그 셀은 이기지 못한다.
   */
  public static SettleResult judgeRoundKpis(AdKpi a, AdKpi b, int elapsedDays, String objective) {
    boolean cpm = TourMetricSpec.of(objective).isCpm();
    double primaryA = cpm ? a.cpm() : a.ctr();
    double primaryB = cpm ? b.cpm() : b.ctr();

    if (a.impressions() == 0 || b.impressions() == 0 || elapsedDays < MIN_ROUND_DAYS) {
      return new SettleResult(
          new AdKpi[] {a, b},
          new RoundVerdict(RoundVerdict.INSUFFICIENT, primaryA, primaryB, 0),
          SettleResult.CHAMPION);
    }

    double confidence =
        cpm
            ? confidenceFromCountTest(a.impressions(), b.impressions())
            : confidenceFromZTest(a, b);
    boolean significant = confidence >= WINNER_CONFIDENCE;

    boolean challengerWins =
        cpm ? primaryB < primaryA : costPerAction(b) < costPerAction(a);

    String rawWinner = significant && challengerWins ? SettleResult.CHALLENGER : SettleResult.CHAMPION;
    return new SettleResult(
        new AdKpi[] {a, b},
        new RoundVerdict(
            significant ? RoundVerdict.WINNER : RoundVerdict.INCONCLUSIVE,
            primaryA,
            primaryB,
            confidence),
        rawWinner);
  }

  private static double costPerAction(AdKpi ad) {
    return ad.clicks() > 0 ? ad.spend() / ad.clicks() : Double.POSITIVE_INFINITY;
  }

  /* ─── 시드 KPI 생성기 (둘러보기 시뮬) ───────────────────────── */

  /** 챌린저 품질 계수 — 라운드마다 결정적. >1 이면 챌린저 우세. */
  private static double challengerFactor(String campaignId, int index) {
    double idxBoost = Math.min(Math.max(index - 1, 0), 4) * 0.05;
    return 0.9 + idxBoost + seededUnit(campaignId + "f") * 0.45;
  }

  /**
   * 라운드 광고별 KPI 생성 (split test = 셀당 동일 예산). ff=0 이면 데이터 없음.
   *
   * <p>factorOverride 는 데모 authoring 용이다(레버별 결과 연출). null 이면 해시 기반 계수를 쓴다.
   */
  public static AdKpi[] roundAdKpis(
      String campaignId,
      int index,
      int fastForwardDays,
      double championCtr,
      double dailyBudget,
      Double factorOverride,
      String objective) {

    int ff = Math.max(0, fastForwardDays);
    if (ff == 0) return new AdKpi[] {AdKpi.EMPTY, AdKpi.EMPTY};

    double factor = factorOverride != null ? factorOverride : challengerFactor(campaignId, index);
    double pace = 0.86 + seededUnit(campaignId + "pace") * 0.1; // 86~96% 예산 소진
    double spendPerCell = Math.round(((dailyBudget * ff) / 2) * pace);

    if (TourMetricSpec.of(objective).isCpm()) {
      // 인지도 — 동일 예산에 노출 볼륨이 갈린다. cpmB = cpmA / factor.
      double cpmA = championCtr;
      double cpmB = championCtr / factor;
      double noise = 0.95 + seededUnit(campaignId + "i") * 0.1;
      double nominalCtr = 0.6; // 결정 지표 아님 — 표시 일관성용 명목값.
      return new AdKpi[] {
        cpmCell(impressionsFrom(cpmA, spendPerCell, noise), nominalCtr, spendPerCell),
        cpmCell(impressionsFrom(cpmB, spendPerCell, noise), nominalCtr, spendPerCell),
      };
    }

    int imp = (int) Math.round(BASE_DAILY_IMP_PER_AD * ff * (0.9 + seededUnit(campaignId + "i") * 0.2));
    int clicksA = (int) Math.max(0, Math.round((imp * championCtr) / 100));
    int clicksB = (int) Math.max(0, Math.round((imp * (championCtr * factor)) / 100));
    return new AdKpi[] {rateCell(imp, clicksA, spendPerCell), rateCell(imp, clicksB, spendPerCell)};
  }

  private static int impressionsFrom(double cpm, double spendPerCell, double noise) {
    if (cpm <= 0) return 0;
    return (int) Math.max(0, Math.round((spendPerCell / cpm) * 1000 * noise));
  }

  private static AdKpi cpmCell(int imp, double nominalCtr, double spend) {
    int clicks = (int) Math.max(0, Math.round((imp * nominalCtr) / 100));
    return new AdKpi(imp, clicks, nominalCtr, spend);
  }

  private static AdKpi rateCell(int imp, int clicks, double spend) {
    double ctr = imp != 0 ? Math.round(((double) clicks / imp) * 10000) / 100.0 : 0;
    return new AdKpi(imp, clicks, ctr, spend);
  }

  /** 데모 결산 — 시드 KPI 를 만든 뒤 판정한다. 실 경로는 Meta KPI 를 judgeRoundKpis 에 직접 넘긴다. */
  public static SettleResult settleRound(
      String campaignId,
      int index,
      int fastForwardDays,
      double championCtr,
      double dailyBudget,
      Double factorOverride,
      String objective) {

    AdKpi[] kpis =
        roundAdKpis(campaignId, index, fastForwardDays, championCtr, dailyBudget, factorOverride, objective);
    return judgeRoundKpis(kpis[0], kpis[1], fastForwardDays, objective);
  }

  /* ─── 상태 판정 ─────────────────────────────────────────────── */

  /** 봉투 소진 (ADR-054) — 누적 예산 또는 목표일 도달. */
  public static boolean isEnvelopeExhausted(TourState t) {
    TourState.Envelope env = t.envelope();
    if (env == null) return false;
    if (env.totalBudget() != null && t.spentBudget() >= env.totalBudget()) return true;
    if (env.targetDate() != null) {
      int simDays =
          t.rounds().stream()
              .filter(r -> "settled".equals(r.status()))
              .mapToInt(TourState.Round::fastForwardDays)
              .sum();
      // TS 는 targetDate 를 KST 자정으로 해석한다(+09:00). 타임존을 바꾸면 하루가 밀린다.
      long budgetDays = daysBetweenIso(t.createdAt(), env.targetDate() + "T00:00:00+09:00");
      if (simDays >= budgetDays) return true;
    }
    return false;
  }

  /** TS 의 daysBetweenIso — 파싱 실패는 Infinity(= 절대 도달 못 함)로 접는다. */
  private static long daysBetweenIso(String start, String end) {
    try {
      Instant s = Instant.parse(start);
      Instant e = java.time.OffsetDateTime.parse(end).toInstant();
      return Math.round(Duration.between(s, e).toMillis() / 86400000.0);
    } catch (DateTimeParseException | ArithmeticException ex) {
      return Long.MAX_VALUE;
    }
  }

  /**
   * 결산 라운드를 역순으로 훑어 챔피언(A) 연속 방어 횟수.
   *
   * <p>insufficient(미결산)는 streak 을 끊지 않고 <b>건너뛴다</b> — 데이터가 없어 판정을 못 한 것이지
   * 챌린저가 이긴 게 아니다.
   */
  public static int championDefendStreak(TourState t) {
    int streak = 0;
    for (int i = t.rounds().size() - 1; i >= 0; i--) {
      TourState.Round r = t.rounds().get(i);
      if (!"settled".equals(r.status()) || RoundVerdict.INSUFFICIENT.equals(r.verdictState())) continue;
      if (SettleResult.CHAMPION.equals(r.rawWinner())) streak += 1;
      else break;
    }
    return streak;
  }

  public static boolean hasConverged(TourState t) {
    Integer n = t.envelope() == null ? null : t.envelope().stopOnDefendStreak();
    return championDefendStreak(t) >= (n == null ? DEFAULT_DEFEND_STREAK : n);
  }

  /** 자동충전 가능 여부 — opt-in 이고 누적 지출이 hardCap 미만일 때만. */
  public static boolean canAutoRefill(TourState t) {
    TourState.AutoRefill ar = t.envelope() == null ? null : t.envelope().autoRefill();
    return ar != null && t.spentBudget() < ar.hardCap();
  }

  /** 사람이 종료 결정 시 사유 — hardCap 까지 쓴 종결은 상한도달, 그 외는 예산소진. */
  public static String endCompletionReason(TourState t) {
    TourState.AutoRefill ar = t.envelope() == null ? null : t.envelope().autoRefill();
    return ar != null && t.spentBudget() >= ar.hardCap() ? "cap-reached" : "budget-exhausted";
  }

  /**
   * 현재 상태 → 비트 (ADR-054). 완전 무인 — 예산 소진에서만 멈춘다.
   *
   * <p>우선순위: champion-review &gt; done &gt; winner-handling &gt; 진행.
   */
  public static String deriveBeat(TourState t) {
    if (!t.championConfirmed()) return "champion-review";
    if ("completed".equals(t.status())) return "done";
    if (isEnvelopeExhausted(t)) return "winner-handling";
    return "auto-running";
  }

  public static boolean isDecisionBeat(String beat) {
    return "winner-handling".equals(beat) || "champion-review".equals(beat);
  }

  public static boolean isRunningBeat(String beat) {
    return "auto-running".equals(beat);
  }
}
