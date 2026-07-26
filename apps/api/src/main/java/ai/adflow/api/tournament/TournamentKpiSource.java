package ai.adflow.api.tournament;

import ai.adflow.api.meta.MetaInsightsClient;
import ai.adflow.api.tournament.engine.AdKpi;
import ai.adflow.api.tournament.engine.RoundVerdict;
import ai.adflow.api.tournament.engine.SettleResult;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 라운드 성과·판정 조회. TS: meta-kpi-source.ts 의 createMetaKpiSource.
 *
 * <p>단계 6 에서 Next 역위임(RoundKpiClient)을 대체했다. 시드 생성기와 달리 실 Meta 노출·클릭·지출을
 * 그대로 옮긴다 — fake-performance 금지 원칙.
 */
@Component
public class TournamentKpiSource {

  /** verdict 이 null 이면 ad study 가 아직 유의성을 못 냈다 — 결산을 보류하고 다음 폴에 재시도한다. */
  public record Reading(List<AdKpi> kpis, RoundVerdict verdict, String winner) {}

  private final MetaInsightsClient insights;

  public TournamentKpiSource(MetaInsightsClient insights) {
    this.insights = insights;
  }

  public Reading read(Tournament t, TourRound round) {
    TournamentDelivery d = t.getDelivery();
    if (d == null) throw new IllegalStateException("실 게재 자격증명이 없는 토너먼트입니다.");

    List<AdKpi> kpis =
        round.getAdIds() == null
            ? List.of(AdKpi.EMPTY, AdKpi.EMPTY)
            : insights.roundAdKpis(round.getCampaignId(), d.getAccessToken(), round.getAdIds());

    // ADR §4 정석 — ad study 의 Meta 유의성 결과를 verdict 로 채택한다(엔진 z-검정 대신).
    if (round.getStudyId() == null) return new Reading(kpis, null, null);
    MetaInsightsClient.StudyResult res = insights.splitTestResult(round.getStudyId(), d.getAccessToken());
    if (res == null) return new Reading(kpis, null, null);

    RoundVerdict verdict =
        new RoundVerdict(
            res.winner() != null ? RoundVerdict.WINNER : RoundVerdict.INCONCLUSIVE,
            kpis.get(0).ctr(),
            kpis.get(1).ctr(),
            res.confidence());

    return new Reading(kpis, verdict, res.winner() != null ? res.winner() : SettleResult.CHAMPION);
  }
}
