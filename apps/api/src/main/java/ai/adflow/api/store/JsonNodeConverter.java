package ai.adflow.api.store;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * 구조를 서버가 해석하지 않는 필드를 JSON 텍스트로 왕복시킨다.
 *
 * jsonb 가 아니라 text 인 이유 — 단위 테스트가 H2 라 jsonb 를 못 쓴다. 이 값으로 질의하지
 * 않으므로 text 로 충분하다. 질의가 필요해지면 컬럼 타입만 jsonb 로 올리면 된다.
 *
 * JsonNode 로 들고 있어야 Jackson 이 문자열이 아니라 원래 구조(배열·객체)로 직렬화한다.
 *
 * 패키지가 tools.jackson 인 것에 주의 — Spring Boot 4 의 HTTP 메시지 컨버터는 Jackson 3 을 쓴다.
 * 클래스패스에 Jackson 2 도 함께 있어서 com.fasterxml.jackson.databind.JsonNode 를 쓰면 컴파일은
 * 되지만 런타임에 HttpMessageConversionException 으로 죽는다. (애노테이션 @JsonIgnore·@JsonInclude
 * 는 Jackson 3 도 com.fasterxml.jackson.annotation 을 그대로 쓴다.)
 */
@Converter
public class JsonNodeConverter implements AttributeConverter<JsonNode, String> {

  private static final ObjectMapper MAPPER = JsonMapper.builder().build();

  @Override
  public String convertToDatabaseColumn(JsonNode node) {
    return node == null ? null : node.toString();
  }

  @Override
  public JsonNode convertToEntityAttribute(String stored) {
    if (stored == null) return null;
    try {
      return MAPPER.readTree(stored);
    } catch (Exception e) {
      throw new IllegalStateException("저장된 JSON 을 읽지 못했어요. 값이 손상됐어요.", e);
    }
  }
}
