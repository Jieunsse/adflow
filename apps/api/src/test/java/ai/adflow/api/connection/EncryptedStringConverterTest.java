package ai.adflow.api.connection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * Meta·Notion 액세스 토큰과 토너먼트 게재 토큰이 전부 이 컨버터 하나를 지난다. 여기가 조용히 망가지면
 * 평문이 컬럼에 앉거나 저장된 토큰을 영영 못 읽는다.
 */
class EncryptedStringConverterTest {

  /** application-test.yml 의 app.encryption.key 와 같은 32바이트. */
  private static final String KEY = "test-encryption-key-32-bytes-ok!";

  private final EncryptedStringConverter converter = new EncryptedStringConverter(KEY);

  @Test
  void 넣은_값이_그대로_돌아온다() {
    String plain = "EAAG…한글도 섞인 토큰";
    assertThat(converter.convertToEntityAttribute(converter.convertToDatabaseColumn(plain)))
        .isEqualTo(plain);
  }

  @Test
  void 저장값에_평문이_보이지_않는다() {
    assertThat(converter.convertToDatabaseColumn("super-secret-token"))
        .doesNotContain("super-secret-token");
  }

  /** IV 를 고정하면 같은 평문이 같은 암호문이 되어 "이 둘은 같은 토큰"이라는 사실이 새어 나간다. */
  @Test
  void 같은_평문도_저장할_때마다_다른_암호문이_된다() {
    assertThat(converter.convertToDatabaseColumn("same"))
        .isNotEqualTo(converter.convertToDatabaseColumn("same"));
  }

  /** GCM 인증 태그 — 저장값이 손대어지면 조용히 이상한 평문을 내놓지 않고 터진다. */
  @Test
  void 저장값이_변조되면_복호화가_터진다() {
    String stored = converter.convertToDatabaseColumn("token");
    String tampered = (stored.charAt(0) == 'A' ? "B" : "A") + stored.substring(1);

    assertThatThrownBy(() -> converter.convertToEntityAttribute(tampered))
        .isInstanceOf(IllegalStateException.class);
  }

  /** 다른 키로 읽으면 못 읽는다 — 키를 잃으면 재로그인 말고는 복구가 없다는 것과 같은 말이다. */
  @Test
  void 키가_다르면_읽지_못한다() {
    String stored = converter.convertToDatabaseColumn("token");
    EncryptedStringConverter other = new EncryptedStringConverter("another-encryption-key-32-byte!!");

    assertThatThrownBy(() -> other.convertToEntityAttribute(stored))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void null_은_그대로_null() {
    assertThat(converter.convertToDatabaseColumn(null)).isNull();
    assertThat(converter.convertToEntityAttribute(null)).isNull();
  }

  /** 짧은 키는 기동 시점에 잡아야 한다 — 첫 저장까지 미루면 그때 토큰이 날아간다. */
  @Test
  void 키가_32바이트가_아니면_생성부터_실패한다() {
    assertThatThrownBy(() -> new EncryptedStringConverter("too-short"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("32바이트");
  }
}
