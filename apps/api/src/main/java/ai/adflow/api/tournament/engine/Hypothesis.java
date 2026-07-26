package ai.adflow.api.tournament.engine;

import tools.jackson.databind.JsonNode;

/**
 * 한 라운드가 검증하는 반증 가능한 인과 단언 (ADR-044). TS: Hypothesis.
 *
 * <p>verdict/effectSize/resolvedAt 은 resolved 일 때만 채워진다.
 */
public record Hypothesis(
    String id,
    String lever,
    String statement,
    String predictedMetric,
    String predictedDirection,
    String rationale,
    String rationaleSource,
    ContextTags contextTags,
    String status,
    String verdict,
    Double effectSize,
    String resolvedAt) {

  public static final String RESOLVED = "resolved";

  /** Ledger 필터·가중 키. */
  public record ContextTags(String productId, String personaId, String objective) {}

  public static Hypothesis fromJson(JsonNode n) {
    JsonNode tags = n.get("contextTags");
    return new Hypothesis(
        text(n.get("id")),
        text(n.get("lever")),
        text(n.get("statement")),
        text(n.get("predictedMetric")),
        text(n.get("predictedDirection")),
        text(n.get("rationale")),
        text(n.get("rationaleSource")),
        new ContextTags(
            text(tags.get("productId")), text(tags.get("personaId")), text(tags.get("objective"))),
        text(n.get("status")),
        text(n.get("verdict")),
        n.get("effectSize") == null || n.get("effectSize").isNull()
            ? null
            : n.get("effectSize").asDouble(),
        text(n.get("resolvedAt")));
  }

  private static String text(JsonNode n) {
    return n == null || n.isNull() ? null : n.asString();
  }
}
