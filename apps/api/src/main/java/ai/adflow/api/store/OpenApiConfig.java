package ai.adflow.api.store;

import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.JsonNode;

/**
 * JsonNode 를 스펙에서 불투명한 객체로 바꾼다.
 *
 * 그러지 않으면 springdoc 이 JsonNode 의 빈 프로퍼티(isArray·isNull·isFloat…)를 스키마로 노출해
 * 계약이 거짓말을 한다. 필드 수준 @ArraySchema 로는 $ref 를 못 이겨서 전역 치환을 쓴다.
 */
@Configuration
public class OpenApiConfig {

  static {
    SpringDocUtils.getConfig().replaceWithClass(JsonNode.class, Object.class);
  }
}
