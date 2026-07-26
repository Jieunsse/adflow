package ai.adflow.api.auth;

import jakarta.validation.constraints.NotBlank;

/** Next.js 서버가 로그인 직후 보내는 신원 + Meta 연결 묶음. */
public record ExchangeRequest(
    @NotBlank String ownerKey,
    @NotBlank String email,
    String role,
    MetaConnectionPayload metaConnection) {

  public record MetaConnectionPayload(
      String accessToken,
      String igAccessToken,
      String adAccountId,
      String adAccountName,
      String pageId,
      String pageName,
      String pixelId,
      String pixelName,
      String igUserId,
      String igUsername) {}
}
