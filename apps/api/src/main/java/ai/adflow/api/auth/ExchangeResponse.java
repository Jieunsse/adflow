package ai.adflow.api.auth;

import java.time.Instant;

public record ExchangeResponse(
    String token, Instant expiresAt, String refreshToken, Instant refreshExpiresAt) {}
