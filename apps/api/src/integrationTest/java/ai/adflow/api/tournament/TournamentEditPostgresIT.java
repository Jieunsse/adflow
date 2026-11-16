package ai.adflow.api.tournament;

import static org.assertj.core.api.Assertions.assertThat;

import ai.adflow.api.IntegrationTestBase;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 사람의 편집과 폴러의 결산이 겹칠 때 무엇이 남는가.
 *
 * <p>단계 6 까지 이 편집들은 Next 가 애그리거트를 통째로 다시 올리는 경로였다. 화면이 들고 있던 스냅샷이
 * 그대로 덮어쓰므로, 그 사이 폴러가 쓴 라운드가 통째로 사라진다. 이 테스트가 그 유실을 재현하고, 새 경로
 * (필요한 필드만 고치는 트랜잭션)에서는 둘 다 남는 것을 확인한다.
 */
class TournamentEditPostgresIT extends IntegrationTestBase {

  @Autowired private TournamentRepository repository;
  @Autowired private TournamentEditService editService;
  @Autowired private TransactionTemplate transactions;

  private static Tournament.Variant variant(String h, String p) {
    Tournament.Variant v = new Tournament.Variant();
    v.setHeadline(h);
    v.setPrimaryText(p);
    return v;
  }

  private Tournament save(String id) {
    TourRound r = new TourRound();
    r.setIndex(1);
    r.setAxis("headline");
    r.setCampaignId("c1");
    r.setChampion(variant("챔피언", "카피"));
    r.setChallenger(variant("챌린저", "카피"));
    r.setFastForwardDays(0);
    r.setStatus("running");

    Tournament t = new Tournament();
    t.setId(id);
    t.setOwnerKey("u@x.com");
    t.setUpdatedAt(Instant.now());
    t.setBrandProfileId("bp_1");
    t.setProductId("prod_1");
    t.setProductName("제품");
    t.setTone("warm");
    t.setObjective("traffic");
    t.setDailyBudget(30000.0);
    t.setChampion(variant("챔피언", "카피"));
    t.setChampionCtr(1.8);
    t.setChampionConfirmed(true);
    t.setAxisCursor(0);
    t.setSpentBudget(0.0);
    t.setStatus("running");
    t.setCreatedAt("2026-07-01T00:00:00Z");
    t.setRounds(new ArrayList<>(List.of(r)));

    TournamentDelivery d = new TournamentDelivery();
    d.setAccessToken("tok");
    d.setAdAccountId("act_1");
    d.setPageId("page_1");
    d.setOwnerEmail("u@x.com");
    t.setDelivery(d);

    return repository.saveAndFlush(t);
  }

  /** 폴러가 라운드를 결산한 것처럼 만든다. */
  private void pollerSettles(String id) {
    transactions.executeWithoutResult(
        s -> {
          Tournament t = repository.findById(id).orElseThrow();
          TourRound r = t.getRounds().get(0);
          TourRound.Verdict v = new TourRound.Verdict();
          v.setState("winner");
          v.setCtrA(1.8);
          v.setCtrB(2.4);
          v.setConfidence(0.97);
          r.setVerdict(v);
          r.setRawWinner("B");
          r.setStatus("settled");
          t.setChampion(t.getRounds().get(0).getChallenger());
          t.setSpentBudget(120000.0);
          repository.save(t);
        });
  }

  @Test
  void 편집과_결산이_겹쳐도_둘_다_남는다() {
    save("t_race_new");

    // 화면이 토너먼트를 읽어 사용자에게 보여준다.
    Tournament seenByUser = repository.findById("t_race_new").orElseThrow();
    assertThat(seenByUser.getRounds().get(0).getStatus()).isEqualTo("running");

    // 그 사이 폴러가 라운드를 결산한다.
    pollerSettles("t_race_new");

    // 사용자가 봉투 충전을 누른다. 화면이 들고 있던 스냅샷이 아니라 "얼마를 더한다"만 보낸다.
    editService.refillEnvelope("t_race_new", 300000.0);

    Tournament after = repository.findById("t_race_new").orElseThrow();
    assertThat(after.getEnvelope().getTotalBudget()).isEqualTo(420000.0); // 사용자 편집이 반영됐고
    assertThat(after.getRounds().get(0).getStatus()).isEqualTo("settled"); // 폴러 결산도 살아 있다
    assertThat(after.getChampion().getHeadline()).isEqualTo("챌린저");
    assertThat(after.getSpentBudget()).isEqualTo(120000.0);
  }

  @Test
  void 애그리거트를_통째로_다시_올리면_결산이_사라진다() {
    // 옛 경로의 재현이다. 이 테스트가 통과하는 한 upsert 를 편집에 쓰면 안 된다는 근거가 남는다.
    save("t_race_old");
    Tournament seenByUser = repository.findById("t_race_old").orElseThrow();

    pollerSettles("t_race_old");

    // 화면이 들고 있던 스냅샷을 그대로 다시 저장한다 (지우고 새로 넣기 = upsert 컨트롤러가 하던 일).
    transactions.executeWithoutResult(
        s -> {
          repository.deleteByIdAndOwnerKey("t_race_old", "u@x.com");
          repository.flush();
          Tournament stale = new Tournament();
          stale.setId("t_race_old");
          stale.setOwnerKey("u@x.com");
          stale.setUpdatedAt(Instant.now());
          stale.setBrandProfileId(seenByUser.getBrandProfileId());
          stale.setProductId(seenByUser.getProductId());
          stale.setProductName(seenByUser.getProductName());
          stale.setTone(seenByUser.getTone());
          stale.setObjective(seenByUser.getObjective());
          stale.setDailyBudget(seenByUser.getDailyBudget());
          stale.setChampion(variant("챔피언", "카피")); // 승격 전 챔피언
          stale.setChampionCtr(seenByUser.getChampionCtr());
          stale.setChampionConfirmed(true);
          stale.setAxisCursor(0);
          stale.setSpentBudget(0.0);
          stale.setStatus("running");
          stale.setCreatedAt(seenByUser.getCreatedAt());
          stale.setRounds(new ArrayList<>()); // 스냅샷 시점엔 결산이 없었다
          repository.save(stale);
        });

    Tournament after = repository.findById("t_race_old").orElseThrow();
    assertThat(after.getRounds()).isEmpty(); // 결산이 통째로 사라졌다
    assertThat(after.getChampion().getHeadline()).isEqualTo("챔피언"); // 승격도 되돌아갔다
  }
}
