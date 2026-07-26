package ai.adflow.api.security;

import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

  @Bean
  SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationConverter converter)
      throws Exception {
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
                    // 교환은 JWT 를 받기 전 단계다. 내부 시크릿으로 따로 지킨다.
                    .requestMatchers("/auth/exchange")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(o -> o.jwt(jwt -> jwt.jwtAuthenticationConverter(converter)));
    return http.build();
  }
}
