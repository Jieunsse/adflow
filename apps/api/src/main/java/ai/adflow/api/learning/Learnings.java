package ai.adflow.api.learning;

import ai.adflow.api.tournament.TourRound;
import ai.adflow.api.tournament.Tournament;
import java.time.Clock;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * 판정이 끝난 라운드에서 배운 것 초안을 만든다 (정책서 14.1).
 *
 * <p>문장은 AI 대신 값으로 채우는 정해진 문장이다. 숫자가 기록과 늘 같고, 바꾼 요소 밖의 원인을 지어내지
 * 않는다. shortcut: 문장이 단조롭다. AI 문장으로 바꿀 때는 숫자 대조(14.1)를 함께 넣는다.
 */
@Service
public class Learnings {

  public static final String CHALLENGER_WON = "challenger_won";
  public static final String CHAMPION_WON = "champion_won";
  public static final String NO_DIFFERENCE = "no_difference";
  public static final String UNJUDGEABLE = "unjudgeable";

  public static final String DRAFT = "draft";
  public static final String CONFIRMED = "confirmed";
  public static final String ARCHIVED = "archived";

  private final LearningRepository repository;
  private final Clock clock;

  public Learnings(LearningRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  /** 같은 라운드는 한 번만 만든다. 다시 판정하지 않으므로 보통 한 번 불린다. */
  public void record(Tournament t, TourRound r, String result) {
    String id = t.getId() + "_r" + r.getIndex();
    if (repository.existsById(id)) return;

    Learning l = new Learning();
    l.setId(id);
    l.setOwnerKey(t.getOwnerKey());
    l.setUpdatedAt(clock.instant());
    l.setBrandProfileId(t.getBrandProfileId());
    l.setTournamentId(t.getId());
    l.setProductName(t.getProductName());
    l.setRoundIndex(r.getIndex());
    l.setAxis(r.getAxis());
    l.setHypothesis(r.getHypothesis() == null ? null : r.getHypothesis().getStatement());
    l.setResult(result);
    if (r.getVerdict() != null) {
      l.setCtrA(r.getVerdict().getCtrA());
      l.setCtrB(r.getVerdict().getCtrB());
      l.setConfidence(r.getVerdict().getConfidence());
    }
    l.setImpressionShortfall(r.getImpressionShortfall());
    if (r.getAdKpis() != null) {
      l.setSpend(r.getAdKpis().stream().mapToDouble(k -> k.getSpend() == null ? 0 : k.getSpend()).sum());
    }
    l.setSentence(sentence(result, r.getAxis(), l.getCtrA(), l.getCtrB(), l.getConfidence(), l.getImpressionShortfall()));
    l.setStatus(DRAFT);
    l.setCreatedAt(clock.instant().toString());
    repository.save(l);
  }

  /** 결과만 쓰고 원인은 단정하지 않는다 (14.1). 200자를 넘지 않는다. */
  public static String sentence(
      String result, String axis, Double ctrA, Double ctrB, Double confidence, Integer shortfall) {
    String what = "primary_text".equals(axis) ? "본문" : "헤드라인";
    return switch (result) {
      case CHALLENGER_WON, CHAMPION_WON -> {
        double diff = Math.abs(nz(ctrB) - nz(ctrA));
        String dir = CHALLENGER_WON.equals(result) ? "높았어요" : "낮았어요";
        yield String.format(
            Locale.ROOT,
            "%s을 바꾼 도전 소재가 기준 소재보다 클릭률이 %.1f%%p %s. (기준 %.1f%%, 도전 %.1f%%, 신뢰도 %.0f%%)",
            what, diff, dir, nz(ctrA), nz(ctrB), nz(confidence) * 100);
      }
      case NO_DIFFERENCE ->
          String.format(
              Locale.ROOT,
              "%s을 바꿨지만 두 소재의 클릭률 차이가 뚜렷하지 않았어요. (기준 %.1f%%, 도전 %.1f%%)",
              what, nz(ctrA), nz(ctrB));
      default ->
          String.format(
              Locale.ROOT,
              "%s을 바꾼 실험은 노출이 %,d회 모자라 판정하지 못했어요.",
              what, shortfall == null ? 0 : shortfall);
    };
  }

  private static double nz(Double v) {
    return v == null ? 0 : v;
  }
}
