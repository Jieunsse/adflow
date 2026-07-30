package ai.adflow.api.security;

import ai.adflow.api.internal.InternalSecret;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

  @Bean
  SecurityFilterChain filterChain(
      HttpSecurity http, JwtAuthenticationConverter converter, InternalSecret internalSecret)
      throws Exception {
    // 시크릿 검사를 컨트롤러가 아니라 여기서 한다. 컨트롤러마다 손으로 부르면 새로 생긴 하나가
    // 빼먹는 순간 조용히 열린다 — 매칭 규칙 옆에 두면 경로를 여는 것과 잠그는 것이 한 줄 차이다.
    AuthorizationManager<RequestAuthorizationContext> hasInternalSecret =
        (authentication, context) ->
            new AuthorizationDecision(
                internalSecret.matches(context.getRequest().getHeader(InternalSecret.HEADER)));

    http
        // 브라우저가 직접 호출하지 않는다(Next.js 서버 전용). 세션도 쿠키도 쓰지 않는 무상태 API.
        .csrf(AbstractHttpConfigurer::disable)
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                // 컨트롤러가 던진 4xx 는 ERROR 디스패치로 /error 를 다시 탄다. 이걸 열어두지 않으면
                // 시큐리티가 그 재진입을 막아 400 이 401 로 뒤바뀐다(MockMvc 는 재현 못 하는 실환경 동작).
                auth.dispatcherTypeMatchers(DispatcherType.ERROR)
                    .permitAll()
                    .requestMatchers("/actuator/**", "/v3/api-docs/**", "/swagger-ui/**")
                    .permitAll()
                    // 교환·갱신은 JWT 를 받기 전/재발급 단계고, cron·Meta webhook 은 세션 없이 도는
                    // 기계 호출이라 JWT 를 실을 수 없다. 여는 것이 아니라 자물쇠를 바꾸는 것이다.
                    .requestMatchers(InternalSecret.PATTERNS)
                    .access(hasInternalSecret)
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(o -> o.jwt(jwt -> jwt.jwtAuthenticationConverter(converter)));
    return http.build();
  }
}
