package ai.adflow.api.security;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

@Component
public class TokenIssuer {

  private final JwtEncoder encoder;
  private final Duration ttl;
  private final Duration refreshTtl;

  public TokenIssuer(
      JwtEncoder encoder,
      @Value("${app.jwt.ttl}") Duration ttl,
      @Value("${app.jwt.refresh-ttl}") Duration refreshTtl) {
    this.encoder = encoder;
    this.ttl = ttl;
    this.refreshTtl = refreshTtl;
  }

  public Issued issue(String ownerKey, String email, Role role) {
    Instant now = Instant.now();
    Instant accessExp = now.plus(ttl);
    Instant refreshExp = now.plus(refreshTtl);

    String access = sign(JwtConfig.TYP_ACCESS, ownerKey, email, role, now, accessExp);
    // refresh 에도 역할을 담는다 — 갱신 시 DB 를 다시 읽지 않고 그대로 넘긴다.
    String refresh = sign(JwtConfig.TYP_REFRESH, ownerKey, email, role, now, refreshExp);

    return new Issued(access, accessExp, refresh, refreshExp);
  }

  private String sign(
      String typ, String ownerKey, String email, Role role, Instant now, Instant expiresAt) {
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("adflow-api")
            .subject(ownerKey)
            .issuedAt(now)
            .expiresAt(expiresAt)
            .claim("email", email)
            .claim(JwtConfig.TYP_CLAIM, typ)
            .claim(JwtConfig.ROLES_CLAIM, List.of(role.authority()))
            .build();

    return encoder
        .encode(JwtEncoderParameters.from(JwsHeader.with(() -> "HS256").build(), claims))
        .getTokenValue();
  }

  public record Issued(
      String token, Instant expiresAt, String refreshToken, Instant refreshExpiresAt) {}
}
