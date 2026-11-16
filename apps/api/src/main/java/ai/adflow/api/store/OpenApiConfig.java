package ai.adflow.api.store;

import ai.adflow.api.internal.InternalSecret;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.List;
import java.util.stream.Stream;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.PathContainer;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;
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

  private static final String SCHEME = "internalSecret";

  private static final List<PathPattern> GUARDED =
      Stream.of(InternalSecret.PATTERNS).map(PathPatternParser.defaultInstance::parse).toList();

  /**
   * 내부 시크릿을 보안 스킴으로 적는다.
   *
   * <p>전에는 컨트롤러마다 {@code @RequestHeader} 로 받아 스펙에 헤더 파라미터로 찍혔다. 검사를
   * SecurityConfig 한 곳으로 올리면서 그 파라미터가 사라졌는데, 스펙에서까지 사라지면 계약이
   * "아무나 부를 수 있다"고 거짓말을 한다.
   */
  @Bean
  OpenApiCustomizer internalSecretScheme() {
    return openApi -> {
      Components components =
          openApi.getComponents() == null ? new Components() : openApi.getComponents();
      openApi.setComponents(
          components.addSecuritySchemes(
              SCHEME,
              new SecurityScheme()
                  .type(SecurityScheme.Type.APIKEY)
                  .in(SecurityScheme.In.HEADER)
                  .name(InternalSecret.HEADER)
                  .description("Next.js 서버만 아는 값. 세션 없이 도는 호출을 이걸로 지킨다.")));

      openApi
          .getPaths()
          .forEach(
              (path, item) -> {
                if (!guarded(path)) return;
                item.readOperations()
                    .forEach(op -> op.addSecurityItem(new SecurityRequirement().addList(SCHEME)));
              });
    };
  }

  private static boolean guarded(String path) {
    PathContainer parsed = PathContainer.parsePath(path);
    return GUARDED.stream().anyMatch(p -> p.matches(parsed));
  }
}
