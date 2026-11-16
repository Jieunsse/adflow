package ai.adflow.api.connection;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AES-GCM 컬럼 암호화. 저장 형식은 Base64(IV ‖ ciphertext ‖ tag).
 *
 * <p>IV 는 매 저장마다 새로 뽑는다 — 고정하면 같은 평문이 같은 암호문이 되어 패턴이 드러난다. GCM 은
 * 인증 태그를 포함하므로 저장값이 변조되면 복호화 단계에서 예외가 난다.
 */
@Component
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

  private static final String TRANSFORMATION = "AES/GCM/NoPadding";
  private static final int IV_BYTES = 12;
  private static final int TAG_BITS = 128;
  private static final SecureRandom RNG = new SecureRandom();

  private final SecretKeySpec key;

  // 생성자 주입만 쓴다. Spring Boot 이 Hibernate 의 bean container 를 SpringBeanContainer 로
  // 등록하므로 Hibernate 가 이 컨버터를 스프링 빈으로 받아간다.
  public EncryptedStringConverter(@Value("${app.encryption.key}") String configured) {
    byte[] raw = configured.getBytes(StandardCharsets.UTF_8);
    if (raw.length != 32) {
      throw new IllegalStateException(
          "app.encryption.key 는 정확히 32바이트여야 해요 (AES-256). 현재 " + raw.length + "바이트.");
    }
    this.key = new SecretKeySpec(raw, "AES");
  }

  @Override
  public String convertToDatabaseColumn(String plain) {
    if (plain == null) return null;
    try {
      byte[] iv = new byte[IV_BYTES];
      RNG.nextBytes(iv);
      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      byte[] ciphertext = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));

      byte[] packed = new byte[iv.length + ciphertext.length];
      System.arraycopy(iv, 0, packed, 0, iv.length);
      System.arraycopy(ciphertext, 0, packed, iv.length, ciphertext.length);
      return Base64.getEncoder().encodeToString(packed);
    } catch (Exception e) {
      throw new IllegalStateException("토큰 암호화에 실패했어요.", e);
    }
  }

  @Override
  public String convertToEntityAttribute(String stored) {
    if (stored == null) return null;
    try {
      byte[] packed = Base64.getDecoder().decode(stored);
      byte[] iv = new byte[IV_BYTES];
      System.arraycopy(packed, 0, iv, 0, IV_BYTES);
      byte[] ciphertext = new byte[packed.length - IV_BYTES];
      System.arraycopy(packed, IV_BYTES, ciphertext, 0, ciphertext.length);

      Cipher cipher = Cipher.getInstance(TRANSFORMATION);
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
      return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("토큰 복호화에 실패했어요. 암호화 키가 바뀌었거나 값이 손상됐어요.", e);
    }
  }
}
