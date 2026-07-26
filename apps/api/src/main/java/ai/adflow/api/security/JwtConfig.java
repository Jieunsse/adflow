package ai.adflow.api.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/** HS256 대칭키 서명. 발급자와 검증자가 모두 이 서비스라 비대칭키가 필요 없다. */
@Configuration
public class JwtConfig {

  public static final String ROLES_CLAIM = "roles";
  public static final String TYP_CLAIM = "typ";
  public static final String TYP_ACCESS = "access";
  public static final String TYP_REFRESH = "refresh";

  private final SecretKeySpec key;

  public JwtConfig(@Value("${app.jwt.secret}") String secret) {
    byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
    if (raw.length < 32) {
      throw new IllegalStateException("app.jwt.secret 은 32바이트 이상이어야 해요 (HS256 요구사항). 현재 " + raw.length + "바이트.");
    }
    this.key = new SecretKeySpec(raw, "HmacSHA256");
  }

  @Bean
  JwtEncoder jwtEncoder() {
    return new NimbusJwtEncoder(new ImmutableSecret<>(key));
  }

  /**
   * 리소스 서버용 — access 토큰만 받는다.
   *
   * 같은 키로 서명한 refresh 토큰이 Bearer 로 통과하면 30일짜리 토큰으로 보호 API 가 전부 열린다.
   * typ 검증기가 그것을 막는 유일한 장치다.
   */
  @Bean
  @Primary
  JwtDecoder jwtDecoder() {
    return decoderRequiring(TYP_ACCESS);
  }

  /** /auth/refresh 전용 — refresh 토큰만 받는다. access 토큰으로는 갱신할 수 없다. */
  @Bean
  JwtDecoder refreshJwtDecoder() {
    return decoderRequiring(TYP_REFRESH);
  }

  private JwtDecoder decoderRequiring(String expectedTyp) {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).build();
    decoder.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefault(), requireTyp(expectedTyp)));
    return decoder;
  }

  private static OAuth2TokenValidator<Jwt> requireTyp(String expected) {
    return jwt ->
        expected.equals(jwt.getClaimAsString(TYP_CLAIM))
            ? OAuth2TokenValidatorResult.success()
            : OAuth2TokenValidatorResult.failure(
                new OAuth2Error("invalid_token", "이 토큰은 " + expected + " 용이 아니에요.", null));
  }

  /** roles 클레임(["LEAD"])을 ROLE_LEAD authority 로 바꾼다 — hasRole("LEAD") 가 동작하게. */
  @Bean
  JwtAuthenticationConverter jwtAuthenticationConverter() {
    JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
    authorities.setAuthorityPrefix("ROLE_");
    authorities.setAuthoritiesClaimName(ROLES_CLAIM);

    JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
    converter.setJwtGrantedAuthoritiesConverter(authorities);
    return converter;
  }
}
