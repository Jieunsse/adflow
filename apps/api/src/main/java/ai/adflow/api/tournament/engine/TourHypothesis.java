package ai.adflow.api.tournament.engine;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 가설 생성기의 결정 코어 (ADR-044). TS: hypothesis.ts 의 순수부.
 *
 * <p>Ledger 와 목표를 읽어 ⓐ재탕 회피 ⓑ미탐색 우선 ⓒ음성 가지치기로 다음 레버를 고르고, 근거를
 * 강제해 가설을 만든다. localStorage 를 만지는 ledger.ts 는 둘러보기 전용이라 포팅 대상이 아니다.
 */
public final class TourHypothesis {

  private TourHypothesis() {}

  /** 토너먼트 묶음에서 resolved 가설을 평탄화 (ADR-047). 실유저 Ledger 는 별도 테이블이 없다. */
  public static List<Hypothesis> deriveLedger(List<List<Hypothesis>> roundHypothesesByTournament) {
    List<Hypothesis> out = new ArrayList<>();
    for (List<Hypothesis> rounds : roundHypothesesByTournament) {
      for (Hypothesis h : rounds) {
        if (h != null && Hypothesis.RESOLVED.equals(h.status())) out.add(h);
      }
    }
    return out;
  }

  /**
   * 현재 제품·목표(·페르소나) 관련 가설만 거른다.
   *
   * <p>personaId 는 <b>한쪽이라도 없으면 통과</b>한다 — 페르소나를 안 정한 맥락에서 과거 학습을
   * 통째로 버리지 않기 위해서다(TS 와 같은 규칙).
   */
  public static List<Hypothesis> filterByContext(List<Hypothesis> entries, LedgerContext ctx) {
    List<Hypothesis> out = new ArrayList<>();
    for (Hypothesis e : entries) {
      Hypothesis.ContextTags t = e.contextTags();
      boolean personaOk =
          ctx.personaId() == null || t.personaId() == null || t.personaId().equals(ctx.personaId());
      if (t.productId().equals(ctx.productId()) && t.objective().equals(ctx.objective()) && personaOk) {
        out.add(e);
      }
    }
    return out;
  }

  public static LedgerSummary summarizeLedger(List<Hypothesis> entries, LedgerContext ctx) {
    List<Hypothesis> relevant = filterByContext(entries, ctx);
    Set<String> confirmed = new LinkedHashSet<>();
    Set<String> refuted = new LinkedHashSet<>();
    Set<String> tested = new LinkedHashSet<>();
    for (Hypothesis h : relevant) {
      if (!Hypothesis.RESOLVED.equals(h.status())) continue;
      tested.add(h.lever());
      if ("confirmed".equals(h.verdict())) confirmed.add(h.lever());
      else if ("refuted".equals(h.verdict())) refuted.add(h.lever());
    }
    return new LedgerSummary(confirmed, refuted, tested, relevant);
  }

  /**
   * 다음 레버 선택 — ⓒ 음성 가지치기 → ⓑ 미탐색 우선 → ⓐ 재탕 회피.
   *
   * <p>같은 (ledger, ctx, seed)면 항상 같은 레버다. 후보가 전부 소진되면 풀 → 전체 레버 순으로
   * 폴백한다 — 정체에서 멈추지 않고 다른 레버로 돌파하는 것이 ADR-054 의 무인화 전제다.
   */
  public static String selectNextLever(List<Hypothesis> entries, LedgerContext ctx, int seed) {
    LedgerSummary s = summarizeLedger(entries, ctx);

    List<String> pool = new ArrayList<>();
    for (String l : Levers.pool(ctx.objective())) if (!s.refuted().contains(l)) pool.add(l);

    List<String> unexplored = new ArrayList<>();
    for (String l : pool) if (!s.tested().contains(l)) unexplored.add(l);

    List<String> candidates = unexplored;
    if (candidates.isEmpty()) {
      candidates = new ArrayList<>();
      for (String l : pool) if (!s.confirmed().contains(l)) candidates.add(l);
    }

    List<String> finalPool = candidates;
    if (finalPool.isEmpty()) finalPool = pool.isEmpty() ? Levers.ALL : pool;

    return finalPool.get(Math.abs(seed) % finalPool.size());
  }

  /** 선택한 레버 + 맥락 → 가설(proposed). 근거 강제 — rationale + rationaleSource 동반. */
  public static Hypothesis buildHypothesis(
      String lever, LedgerContext ctx, String rationaleSource, String idSeed) {

    TourMetricSpec spec = TourMetricSpec.of(ctx.objective());
    Levers.Template tpl = Levers.template(lever);
    return new Hypothesis(
        "hyp_" + idSeed,
        lever,
        tpl.claim().replace("{metric}", spec.rateLabel()),
        spec.rateLabel(),
        spec.higherBetter() ? "up" : "down",
        tpl.rationale(),
        rationaleSource,
        new Hypothesis.ContextTags(ctx.productId(), ctx.personaId(), ctx.objective()),
        "proposed",
        null,
        null,
        null);
  }

  /** 레버에 맞춰 챌린저 변형 구성 — 단일 가설이 건드리는 슬롯을 묶음 교체. */
  public static TourVariant buildLeverChallenger(
      TourVariant champion, String lever, List<String> headlines, List<String> primaryTexts) {

    if (Levers.swapsHeadline(lever)) {
      String h = firstDifferent(headlines, champion.headline());
      return new TourVariant(h == null ? champion.headline() : h, champion.primaryText(), champion.imageUrl());
    }
    String t = firstDifferent(primaryTexts, champion.primaryText());
    return new TourVariant(champion.headline(), t == null ? champion.primaryText() : t, champion.imageUrl());
  }

  /** 비지 않고 챔피언과 다른 첫 값, 없으면 첫 값, 그것도 없으면 null. TS 의 find ?? [0] ?? 원본. */
  private static String firstDifferent(List<String> candidates, String current) {
    if (candidates == null || candidates.isEmpty()) return null;
    for (String c : candidates) {
      if (c != null && !c.trim().isEmpty() && !c.trim().equals(current.trim())) return c;
    }
    return candidates.get(0);
  }

  /**
   * 데모 전용 — 레버별 결과 authoring (PRD §2.1.6 반증 연출).
   *
   * <p>실 경로는 Meta 실측이라 쓰지 않는다. 둘러보기가 음성 학습을 한 화면에 시연하기 위한 것이다.
   */
  public static double demoLeverFactor(String lever, String campaignId) {
    double j = TourEngine.seededUnit(campaignId + "lf");
    if (Levers.isDemoRefuting(lever)) return 0.8 + j * 0.06; // 챔피언 유의 방어 = 반증
    if (Levers.isDemoStrong(lever)) return 1.16 + j * 0.12; // 강한 lift = 입증
    return 0.985 + j * 0.05; // near-tie → inconclusive 경향
  }

  /**
   * 결산 결과 → 가설 verdict. 챌린저 유의 승격=입증 / 챔피언 유의 방어=반증 / 그 외=미결.
   *
   * <p>effectSize 는 챌린저가 결정 지표를 얼마나 개선했는지(%)다 — cpm 목표는 낮을수록 개선이라
   * 부호를 뒤집는다.
   */
  public static Hypothesis resolveHypothesis(
      Hypothesis h, RoundVerdict verdict, String rawWinner, String resolvedAt) {

    String v =
        RoundVerdict.WINNER.equals(verdict.state())
            ? (SettleResult.CHALLENGER.equals(rawWinner) ? "confirmed" : "refuted")
            : "inconclusive";

    TourMetricSpec spec = TourMetricSpec.of(h.contextTags().objective());
    double a = verdict.ctrA();
    double b = verdict.ctrB();
    double rawLift = a > 0 ? ((b - a) / a) * 100 : 0;
    double effectSize = Math.round((spec.higherBetter() ? rawLift : -rawLift) * 10) / 10.0;

    return new Hypothesis(
        h.id(),
        h.lever(),
        h.statement(),
        h.predictedMetric(),
        h.predictedDirection(),
        h.rationale(),
        h.rationaleSource(),
        h.contextTags(),
        Hypothesis.RESOLVED,
        v,
        effectSize,
        resolvedAt);
  }
}
