package ai.adflow.api.tournament;

import ai.adflow.api.meta.MetaSplitTestLauncher;
import ai.adflow.api.meta.SplitTestRequest;
import ai.adflow.api.tournament.engine.TourEngine;
import ai.adflow.api.tournament.engine.TourVariant;
import java.time.Clock;
import java.time.Duration;
import org.springframework.stereotype.Component;

/**
 * 토너먼트 라운드 → Meta split test 게재. TS: meta-launcher.ts 의 createMetaRoundLauncher.
 *
 * <p>도메인(토너먼트)과 전송(Meta)의 이음매다. 봉투(delivery)에서 자격증명·타겟을, 라운드에서
 * 챔피언·챌린저와 갈리는 축을 뽑아 SplitTestRequest 하나로 접는다.
 */
@Component
public class TournamentRoundLauncher {

  private final MetaSplitTestLauncher meta;
  private final Clock clock;

  public TournamentRoundLauncher(MetaSplitTestLauncher meta, Clock clock) {
    this.meta = meta;
    this.clock = clock;
  }

  public MetaSplitTestLauncher.LaunchResult launch(Tournament t, TourRound round) {
    TournamentDelivery d = t.getDelivery();
    if (d == null) throw new IllegalStateException("실 게재 자격증명이 없는 토너먼트입니다.");

    // 이미지 축은 토너먼트 자동 순회에 없다(헤드라인/카피 전용) — 헤드라인 차이로 접는다.
    String rawAxis = TourEngine.deriveAxis(variant(round.getChampion()), variant(round.getChallenger()));
    String axis = "image".equals(rawAxis) ? "headline" : rawAxis;

    SplitTestRequest req =
        new SplitTestRequest(
            round.getChampion().getHeadline(),
            round.getChampion().getPrimaryText(),
            axis,
            round.getChallenger().getHeadline(),
            round.getChallenger().getPrimaryText(),
            t.getDailyBudget() == null ? 0 : t.getDailyBudget(),
            isoDateKst(0),
            isoDateKst(d.getRoundDays() == null ? 0 : d.getRoundDays()),
            d.getAgeMin(),
            d.getAgeMax(),
            d.getGenders(),
            d.getCountries(),
            d.getLinkUrl(),
            d.getCtaType(),
            d.getImageDataUrl(),
            d.getGoalId(),
            t.getProductName());

    return meta.launch(req, d.getAccessToken(), d.getAdAccountId(), d.getPageId());
  }

  /** KST 기준 날짜 — UTC 로 자르면 오후 3시 이후 게재가 하루 앞당겨진다. */
  private String isoDateKst(int daysFromNow) {
    return clock.instant().plus(Duration.ofHours(9)).plus(Duration.ofDays(daysFromNow)).toString().substring(0, 10);
  }

  private static TourVariant variant(Tournament.Variant v) {
    return v == null ? null : new TourVariant(v.getHeadline(), v.getPrimaryText(), v.getImageUrl());
  }
}
