package ai.adflow.api.tournament.engine;

/**
 * 라운드 판정 결과. TS: RoundVerdict.
 *
 * <p>state 를 enum 으로 만들지 않는다 — TS 유니온이 진실의 원천이고, 옮기면 목록이 두 곳에 살아
 * 드리프트한다(단계 3 의 goalId·단계 4 의 ReferenceMaterial.type 과 같은 판단).
 *
 * <p>ctrA/ctrB 는 목표에 따라 의미가 다르다 — rate 목표는 action 비율%, cpm 목표는 CPM 원.
 */
public record RoundVerdict(String state, double ctrA, double ctrB, double confidence) {

  public static final String INSUFFICIENT = "insufficient";
  public static final String INCONCLUSIVE = "inconclusive";
  public static final String WINNER = "winner";
}
