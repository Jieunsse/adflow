package ai.adflow.api.tournament;

import static ai.adflow.api.tournament.TournamentSettleService.Gate.JUDGE;
import static ai.adflow.api.tournament.TournamentSettleService.Gate.UNJUDGEABLE;
import static ai.adflow.api.tournament.TournamentSettleService.Gate.WAIT;
import static ai.adflow.api.tournament.TournamentSettleService.gate;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** 판정 조건 (정책서 13.1·13.3). */
class SettleGateTest {

  @Test
  void 조건을_다_채우면_판정한다() {
    assertThat(gate(4.0, 4, 0, true)).isEqualTo(JUDGE);
  }

  @Test
  void 나흘이_안_됐으면_Meta_결과가_있어도_기다린다() {
    assertThat(gate(3.9, 4, 0, true)).isEqualTo(WAIT);
  }

  @Test
  void 노출이_모자라면_기간_안에는_기다리고_기간이_끝나면_판정_불가다() {
    assertThat(gate(2.0, 4, 620, true)).isEqualTo(WAIT);
    assertThat(gate(4.0, 4, 620, true)).isEqualTo(UNJUDGEABLE);
    assertThat(gate(7.5, 7, 1, false)).isEqualTo(UNJUDGEABLE);
  }

  @Test
  void 노출은_채웠는데_Meta_결과가_아직이면_기간이_지나도_기다린다() {
    assertThat(gate(9.0, 4, 0, false)).isEqualTo(WAIT);
  }
}
