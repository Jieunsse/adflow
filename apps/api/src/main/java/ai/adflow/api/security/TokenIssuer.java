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

  public TokenIssuer(JwtEncoder encoder, @Value("${app.jwt.ttl}") Duration ttl) {
    this.encoder = encoder;
    this.ttl = ttl;
  }

  public Issued issue(String ownerKey, String email, Role role) {
    Instant now = Instant.now();
    Instant expiresAt = now.plus(ttl);

    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("adflow-api")
            .subject(ownerKey)
            .issuedAt(now)
            .expiresAt(expiresAt)
            .claim("email", email)
            .claim(JwtConfig.ROLES_CLAIM, List.of(role.authority()))
            .build();

    String token =
        encoder
            .encode(JwtEncoderParameters.from(JwsHeader.with(() -> "HS256").build(), claims))
            .getTokenValue();

    return new Issued(token, expiresAt);
  }

  public record Issued(String token, Instant expiresAt) {}
}
