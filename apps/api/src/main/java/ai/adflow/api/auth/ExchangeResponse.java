package ai.adflow.api.auth;

import java.time.Instant;

/** role 은 서버가 정한 역할의 화면 이름(팀장 등)이다. 웹은 이 값을 세션 역할로 쓴다. */
public record ExchangeResponse(
    String token, Instant expiresAt, String refreshToken, Instant refreshExpiresAt, String role) {}
