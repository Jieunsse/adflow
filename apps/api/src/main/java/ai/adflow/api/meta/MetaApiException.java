package ai.adflow.api.meta;

/**
 * Meta 그래프 API 가 돌려준 오류. TS: MetaApiError.
 *
 * <p>message 는 평탄화 문자열을 그대로 보존하고 code/subcode 를 구조화해 노출한다 — 호출자가
 * 문자열을 정규식으로 재파싱하지 않아도 된다.
 *
 * <p>{@code authExpired} 는 TS 의 AuthError 자리다. code 190 = 토큰 만료 → 재로그인이 필요하고,
 * 게재 거절과 달리 한국어로 번역하지 않고 그대로 올려보낸다.
 */
public class MetaApiException extends RuntimeException {

  private final int code;
  private final Integer subcode;
  private final String userMessage;
  private final boolean authExpired;

  public MetaApiException(String message, int code, Integer subcode, String userMessage) {
    super(message);
    this.code = code;
    this.subcode = subcode;
    this.userMessage = userMessage;
    this.authExpired = code == 190;
  }

  public int getCode() {
    return code;
  }

  public Integer getSubcode() {
    return subcode;
  }

  public String getUserMessage() {
    return userMessage;
  }

  public boolean isAuthExpired() {
    return authExpired;
  }
}
