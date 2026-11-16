package ai.adflow.api.store.creator;

/**
 * TS: CreatorPlatform = "instagram" | "youtube" | "tiktok" | "other".
 *
 * 상수명이 곧 와이어 값이라 소문자로 쓴다. 자바 관례(대문자)를 따르면 @JsonProperty 가 붙고
 * springdoc 이 내는 OpenAPI enum 값과 실제 JSON 값이 갈릴 위험이 생긴다.
 */
public enum CreatorPlatform {
  instagram,
  youtube,
  tiktok,
  other
}
