package ai.adflow.api.auth;

import jakarta.validation.constraints.NotBlank;

/** Next.js 서버가 로그인 직후 보내는 신원 + Meta 연결 묶음. */
public record ExchangeRequest(
    @NotBlank String ownerKey,
    @NotBlank String email,
    // 고객 로그인(이메일·카카오·구글)이면 true. 그때는 새 워크스페이스를 만들지 않고 고객으로 등록된 사람만 받는다.
    Boolean client,
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
