package ai.adflow.api.tournament.engine;

import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * 엔진이 상태 판정에 실제로 보는 것만 담은 뷰. TS Tournament 29필드 중 6개뿐이다.
 *
 * <p>영속 엔티티(Tournament)를 엔진에 직접 넘기지 않는다 — 엔진이 JPA 를 모르게 두면 골든 픽스처가
 * 순수 함수만 대조하면 되고, 애그리거트 모양이 바뀌어도 판정 로직이 흔들리지 않는다.
 */
public record TourState(
    boolean championConfirmed,
    String status,
    double spentBudget,
    String createdAt,
    Envelope envelope,
    List<Round> rounds) {

  /** 자동 봉투 (ADR-054/061). 전 필드 optional 이다. */
  public record Envelope(
      Double totalBudget, String targetDate, AutoRefill autoRefill, Integer stopOnDefendStreak) {}

  public record AutoRefill(double addBudget, double hardCap) {}

  /** 라운드에서 상태 판정에 쓰이는 부분만. */
  public record Round(String status, String rawWinner, String verdictState, int fastForwardDays) {}

  public static TourState fromJson(JsonNode n) {
    return new TourState(
        bool(n.get("championConfirmed")),
        text(n.get("status")),
        n.has("spentBudget") ? n.get("spentBudget").asDouble() : 0,
        text(n.get("createdAt")),
        envelopeFrom(n.get("envelope")),
        roundsFrom(n.get("rounds")));
  }

  private static Envelope envelopeFrom(JsonNode n) {
    if (n == null || n.isNull()) return null;
    JsonNode refill = n.get("autoRefill");
    return new Envelope(
        num(n.get("totalBudget")),
        text(n.get("targetDate")),
        refill == null || refill.isNull()
            ? null
            : new AutoRefill(refill.get("addBudget").asDouble(), refill.get("hardCap").asDouble()),
        n.get("stopOnDefendStreak") == null || n.get("stopOnDefendStreak").isNull()
            ? null
            : n.get("stopOnDefendStreak").asInt());
  }

  private static List<Round> roundsFrom(JsonNode n) {
    List<Round> out = new ArrayList<>();
    if (n == null || !n.isArray()) return out;
    for (JsonNode r : n) {
      JsonNode verdict = r.get("verdict");
      out.add(
          new Round(
              text(r.get("status")),
              text(r.get("rawWinner")),
              verdict == null || verdict.isNull() ? null : text(verdict.get("state")),
              r.has("fastForwardDays") ? r.get("fastForwardDays").asInt() : 0));
    }
    return out;
  }

  private static boolean bool(JsonNode n) {
    return n != null && !n.isNull() && n.asBoolean();
  }

  private static String text(JsonNode n) {
    return n == null || n.isNull() ? null : n.asString();
  }

  private static Double num(JsonNode n) {
    return n == null || n.isNull() ? null : n.asDouble();
  }
}
