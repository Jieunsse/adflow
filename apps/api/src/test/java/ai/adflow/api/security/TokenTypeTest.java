package ai.adflow.api.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class TokenTypeTest {

  @Autowired private TokenIssuer tokenIssuer;
  @Autowired private JwtDecoder jwtDecoder; // @Primary = access 전용
  @Autowired @Qualifier("refreshJwtDecoder") private JwtDecoder refreshJwtDecoder;

  private TokenIssuer.Issued issued() {
    return tokenIssuer.issue("owner@example.com", "owner@example.com", Role.LEAD);
  }

  @Test
  void access_토큰은_access_디코더를_통과한다() {
    var jwt = jwtDecoder.decode(issued().token());
    assertThat(jwt.getSubject()).isEqualTo("owner@example.com");
    assertThat(jwt.getClaimAsStringList("roles")).containsExactly("LEAD");
    assertThat(jwt.getClaimAsString("typ")).isEqualTo("access");
  }

  @Test
  void refresh_토큰은_리소스서버_디코더에서_거부된다() {
    String refresh = issued().refreshToken();
    // 이게 이 Task 의 요지다 — 30일짜리 refresh 로 보호 API 를 열 수 없어야 한다.
    assertThatThrownBy(() -> jwtDecoder.decode(refresh))
        .isInstanceOf(JwtValidationException.class);
  }

  @Test
  void access_토큰은_refresh_디코더에서_거부된다() {
    String access = issued().token();
    assertThatThrownBy(() -> refreshJwtDecoder.decode(access))
        .isInstanceOf(JwtValidationException.class);
  }

  @Test
  void refresh_토큰이_access_보다_오래_산다() {
    var i = issued();
    assertThat(i.refreshExpiresAt()).isAfter(i.expiresAt());
  }
}
