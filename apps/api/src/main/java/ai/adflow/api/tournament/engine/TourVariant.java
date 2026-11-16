package ai.adflow.api.tournament.engine;

import tools.jackson.databind.JsonNode;

/** 크리에이티브 변형. TS: TourVariant. imageUrl 은 optional. */
public record TourVariant(String headline, String primaryText, String imageUrl) {

  public static TourVariant fromJson(JsonNode n) {
    if (n == null || n.isNull()) return null;
    JsonNode image = n.get("imageUrl");
    return new TourVariant(
        text(n.get("headline")),
        text(n.get("primaryText")),
        image == null || image.isNull() ? null : image.asString());
  }

  private static String text(JsonNode n) {
    return n == null || n.isNull() ? "" : n.asString();
  }
}
