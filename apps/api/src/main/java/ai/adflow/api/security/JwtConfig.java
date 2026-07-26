package ai.adflow.api.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

/** HS256 대칭키 서명. 발급자와 검증자가 모두 이 서비스라 비대칭키가 필요 없다. */
@Configuration
public class JwtConfig {

  public static final String ROLES_CLAIM = "roles";

  private final SecretKeySpec key;

  public JwtConfig(@Value("${app.jwt.secret}") String secret) {
    byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
    if (raw.length < 32) {
      throw new IllegalStateException(
          "app.jwt.secret 은 32바이트 이상이어야 해요 (HS256 요구사항). 현재 " + raw.length + "바이트.");
    }
    this.key = new SecretKeySpec(raw, "HmacSHA256");
  }

  @Bean
  JwtEncoder jwtEncoder() {
    return new NimbusJwtEncoder(new ImmutableSecret<>(key));
  }

  @Bean
  JwtDecoder jwtDecoder() {
    return NimbusJwtDecoder.withSecretKey(key).build();
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
