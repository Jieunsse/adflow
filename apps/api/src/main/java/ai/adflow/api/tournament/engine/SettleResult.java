package ai.adflow.api.tournament.engine;

/** 결산 결과. TS: SettleResult. rawWinner 는 "A"(챔피언 방어) 또는 "B"(챌린저 승격). */
public record SettleResult(AdKpi[] kpis, RoundVerdict verdict, String rawWinner) {

  public static final String CHAMPION = "A";
  public static final String CHALLENGER = "B";
}
