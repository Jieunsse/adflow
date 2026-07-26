package ai.adflow.api.tournament;

import ai.adflow.api.meta.MetaSplitTestLauncher;
import ai.adflow.api.tournament.engine.Hypothesis;
import ai.adflow.api.tournament.engine.LedgerContext;
import ai.adflow.api.tournament.engine.TourEngine;
import ai.adflow.api.tournament.engine.TourHypothesis;
import ai.adflow.api.tournament.engine.TourVariant;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * auto 무인 체인 (ADR-054) — 봉투가 남아 있으면 다음 챌린저를 세우고 게재한다. TS: server-runner.ts 의
 * proposeChallenger · launchRound · autoAdvance.
 *
 * <p>정지 지점은 하나뿐이다: 게재 실패(lastError). 금칙어는 생성 단계에서 구조로 배제되고 정체는
 * 레버 폴백으로 돌파하므로 사람을 기다릴 자리가 없다. 봉투 소진도 자동 완료가 아니라 winner-handling
 * 으로 surface 한다.
 */
@Service
public class TournamentAdvanceService {

  private static final Logger log = LoggerFactory.getLogger(TournamentAdvanceService.class);

  private final TournamentRepository repository;
  private final ChallengerCopyClient copy;
  private final TournamentRoundLauncher launcher;
  private final Clock clock;

  public TournamentAdvanceService(
      TournamentRepository repository,
      ChallengerCopyClient copy,
      TournamentRoundLauncher launcher,
      Clock clock) {
    this.repository = repository;
    this.copy = copy;
    this.launcher = launcher;
    this.clock = clock;
  }

  /** 게재까지 갔으면 true. 게이트에 막혔거나 실패면 false. */
  @Transactional
  public boolean autoAdvance(String id) {
    Tournament t = repository.findById(id).orElse(null);
    if (t == null || "completed".equals(t.getStatus())) return false;
    // ADR-053 — 게재 실패로 멈춘 토너먼트는 사람이 손볼 때까지 진행하지 않는다(자동충전보다 먼저).
    if (t.getLastError() != null) return false;
    if (!Boolean.TRUE.equals(t.getChampionConfirmed())) return false;
    if (hasRunningRound(t)) return false;

    // ADR-061 — 봉투 소진 시 autoRefill opt-in 이고 hardCap 미만이면 자동 충전.
    if (TourEngine.isEnvelopeExhausted(TourStates.of(t)) && TourEngine.canAutoRefill(TourStates.of(t))) {
      Tournament.Envelope env = t.getEnvelope();
      double base = env.getTotalBudget() == null ? nz(t.getSpentBudget()) : env.getTotalBudget();
      env.setTotalBudget(base + env.getAutoRefill().getAddBudget());
      repository.save(t);
    }
    if (TourEngine.isEnvelopeExhausted(TourStates.of(t))) return false;

    if (t.getPendingChallenger() == null) {
      try {
        propose(t);
      } catch (RuntimeException e) {
        // 카피 생성 실패는 일시적이다 — 다음 폴에 재시도한다.
        log.warn("챌린저 생성 실패, 다음 폴에 재시도합니다: {} — {}", id, e.getMessage());
        return false;
      }
    }

    try {
      launch(t);
      repository.save(t);
      return true;
    } catch (RuntimeException e) {
      // ADR-053 — Meta 가 split test 게재를 거절하면 사전 탐지가 불가능하다. 한국어로 박아두고
      // 자동 진행을 멈춘다. 조용히 방치되지 않게 화면이 상세 배너로 surface 한다.
      Tournament fresh = repository.findById(id).orElse(null);
      if (fresh != null) {
        fresh.setLastError(e.getMessage());
        repository.save(fresh);
      }
      return false;
    }
  }

  /** ADR-044/047 — Ledger 투영으로 다음 레버를 고르고 가설 + 챌린저를 pending 으로 보관. */
  public void propose(Tournament t) {
    ChallengerCopyClient.Copy gen = copy.generate(t);
    int index = t.getRounds().size() + 1;
    LedgerContext ctx = new LedgerContext(t.getProductId(), null, t.getObjective());

    List<Hypothesis> ledger = ledgerFor(t);
    String lever = TourHypothesis.selectNextLever(ledger, ctx, index);
    boolean hasPrior = !TourHypothesis.summarizeLedger(ledger, ctx).relevant().isEmpty();

    Hypothesis h =
        TourHypothesis.buildHypothesis(
            lever, ctx, hasPrior ? "ledger" : "platform-prior", t.getId() + "_r" + index);
    TourVariant challenger =
        TourHypothesis.buildLeverChallenger(
            variant(t.getChampion()), lever, gen.headlines(), gen.primaryTexts());

    t.setPendingHypothesis(hypothesisEntity(h));
    t.setPendingChallenger(variantEntity(challenger));
  }

  /** pending 챌린저를 실 Meta A/B 게재. campaignId·adIds·launchedAt 을 라운드에 박아둔다. */
  public void launch(Tournament t) {
    Tournament.Variant challenger = t.getPendingChallenger();
    if (challenger == null) throw new IllegalStateException("게재할 챌린저가 없어요.");

    int index = t.getRounds().size() + 1;
    TourRound round = new TourRound();
    round.setIndex(index);
    round.setAxis(TourEngine.deriveAxis(variant(t.getChampion()), variant(challenger)));
    round.setCampaignId(TourEngine.roundCampaignId(t.getId(), index));
    round.setChampion(t.getChampion());
    round.setChallenger(challenger);
    round.setFastForwardDays(0);
    round.setStatus("running");
    if (t.getPendingHypothesis() != null) {
      TourRound.HypothesisData h = t.getPendingHypothesis();
      h.setStatus("testing"); // ADR-044 — proposed → testing 은 게재 시점이다
      round.setHypothesis(h);
    }

    MetaSplitTestLauncher.LaunchResult res = launcher.launch(t, round);
    round.setCampaignId(res.campaignId());
    round.setAdIds(res.adIds());
    round.setAdSetIds(res.adSetIds());
    round.setStudyId(res.studyId());
    round.setLaunchedAt(clock.instant().toString());

    t.addRound(round);
    t.setPendingChallenger(null);
    t.setPendingHypothesis(null);
  }

  /** ADR-047 — 소유 유저의 같은 브랜드 토너먼트에서 resolved 가설을 평탄화한다. */
  private List<Hypothesis> ledgerFor(Tournament t) {
    String ownerKey = t.getDelivery() == null ? null : t.getDelivery().getOwnerEmail();
    if (ownerKey == null) return List.of();

    List<List<Hypothesis>> byTournament = new ArrayList<>();
    for (Tournament other :
        repository.findByOwnerKeyAndBrandProfileIdOrderByCreatedAtDesc(ownerKey, t.getBrandProfileId())) {
      List<Hypothesis> rounds = new ArrayList<>();
      for (TourRound r : other.getRounds()) {
        if (r.getHypothesis() != null) rounds.add(TourStates.hypothesisOf(r.getHypothesis()));
      }
      byTournament.add(rounds);
    }
    return TourHypothesis.deriveLedger(byTournament);
  }

  private static boolean hasRunningRound(Tournament t) {
    return t.getRounds().stream().anyMatch(r -> "running".equals(r.getStatus()));
  }

  private static TourVariant variant(Tournament.Variant v) {
    return v == null ? null : new TourVariant(v.getHeadline(), v.getPrimaryText(), v.getImageUrl());
  }

  private static Tournament.Variant variantEntity(TourVariant v) {
    Tournament.Variant out = new Tournament.Variant();
    out.setHeadline(v.headline());
    out.setPrimaryText(v.primaryText());
    out.setImageUrl(v.imageUrl());
    return out;
  }

  private static TourRound.HypothesisData hypothesisEntity(Hypothesis h) {
    TourRound.ContextTags tags = new TourRound.ContextTags();
    tags.setProductId(h.contextTags().productId());
    tags.setPersonaId(h.contextTags().personaId());
    tags.setObjective(h.contextTags().objective());

    TourRound.HypothesisData out = new TourRound.HypothesisData();
    out.setId(h.id());
    out.setLever(h.lever());
    out.setStatement(h.statement());
    out.setPredictedMetric(h.predictedMetric());
    out.setPredictedDirection(h.predictedDirection());
    out.setRationale(h.rationale());
    out.setRationaleSource(h.rationaleSource());
    out.setContextTags(tags);
    out.setStatus(h.status());
    return out;
  }

  private static double nz(Double v) {
    return v == null ? 0 : v;
  }
}
