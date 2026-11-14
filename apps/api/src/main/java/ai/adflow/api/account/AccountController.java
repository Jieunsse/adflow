package ai.adflow.api.account;

import ai.adflow.api.security.Role;
import ai.adflow.api.workspace.MemberRepository;
import jakarta.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 고객 이메일 가입·인증·로그인·비밀번호 재설정 (정책서 3.1). Next 서버(NextAuth)만 부른다 — 내부 시크릿으로
 * 지킨다(InternalSecret.PATTERNS).
 *
 * <p>가입은 직원이 고객으로 등록한 이메일만 된다. 아무 이메일이나 받으면 고객사 담당자의 이메일을 아는 사람이 먼저
 * 가입해 그 회사 화면에 들어갈 수 있다. 그래서 인증 메일로 메일함 주인임을 확인한 뒤에만 로그인된다.
 */
@RestController
@RequestMapping("/auth/account")
public class AccountController {

  public record SignupRequest(
      String email, String password, Boolean agreeTerms, Boolean agreePrivacy, Boolean over14, Boolean marketing) {}

  public record TokenRequest(String token) {}

  public record LoginRequest(String email, String password) {}

  public record EmailRequest(String email) {}

  public record ResetRequest(String token, String password) {}

  static final String VERIFY = "verify";
  static final String RESET = "reset";
  static final Duration VERIFY_TTL = Duration.ofHours(24);
  static final Duration RESET_TTL = Duration.ofMinutes(30);
  static final int MAX_FAILS = 5;
  static final Duration LOCK = Duration.ofMinutes(15);

  private static final SecureRandom RANDOM = new SecureRandom();

  private final ClientAccountRepository accounts;
  private final EmailTokenRepository tokens;
  private final MemberRepository members;
  private final Mailer mailer;
  private final Clock clock;
  private final String webBase;
  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

  public AccountController(
      ClientAccountRepository accounts,
      EmailTokenRepository tokens,
      MemberRepository members,
      Mailer mailer,
      Clock clock,
      @Value("${app.web-base-url:http://localhost:3000}") String webBase) {
    this.accounts = accounts;
    this.tokens = tokens;
    this.members = members;
    this.mailer = mailer;
    this.clock = clock;
    this.webBase = webBase;
  }

  @PostMapping("/signup")
  @Transactional
  public Map<String, Boolean> signup(@RequestBody SignupRequest body) {
    String email = normalize(body.email());
    requireClient(email);
    if (!Boolean.TRUE.equals(body.agreeTerms()) || !Boolean.TRUE.equals(body.agreePrivacy())) {
      throw bad("이용약관과 개인정보처리방침에 모두 동의해야 가입할 수 있어요.");
    }
    if (!Boolean.TRUE.equals(body.over14())) throw bad("만 14세 이상만 가입할 수 있어요.");
    checkPassword(body.password());

    ClientAccount existing = accounts.findById(email).orElse(null);
    if (existing != null && existing.getVerifiedAt() != null) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 가입한 이메일이에요. 로그인해 주세요.");
    }
    Instant now = clock.instant();
    ClientAccount a = existing != null ? existing : new ClientAccount(email, "", now, false);
    // 인증 전에 다시 가입하면 새 비밀번호로 바꾸고 인증 메일을 다시 보낸다.
    a.setPasswordHash(encoder.encode(body.password()));
    a.setAgreedAt(now);
    a.setMarketingOptIn(Boolean.TRUE.equals(body.marketing()));
    accounts.save(a);

    String link = webBase + "/verify-email?token=" + issue(email, VERIFY, VERIFY_TTL);
    mailer.send(email, "[AdFlow] 이메일을 확인해 주세요",
        "AdFlow 가입을 마치려면 아래 링크를 눌러 주세요. 링크는 24시간 동안 한 번만 쓸 수 있어요.\n\n" + link
            + "\n\n가입한 적이 없다면 이 메일은 무시해 주세요.");
    return Map.of("ok", true);
  }

  @PostMapping("/verify")
  @Transactional
  public Map<String, String> verify(@RequestBody TokenRequest body) {
    EmailToken t = use(body.token(), VERIFY, "인증 링크가 만료됐거나 이미 쓴 링크예요. 다시 가입해 인증 메일을 받아 주세요.");
    ClientAccount a = accounts.findById(t.getEmail()).orElseThrow(() -> bad("가입 정보를 찾지 못했어요. 다시 가입해 주세요."));
    a.setVerifiedAt(clock.instant());
    accounts.save(a);
    return Map.of("email", a.getEmail());
  }

  /** 5번 연속 틀리면 15분 동안 막는다 (정책서 3.1). 맞아도 막힌 동안은 거절한다. */
  @PostMapping("/login")
  @Transactional(dontRollbackOn = ResponseStatusException.class)
  public Map<String, String> login(@RequestBody LoginRequest body) {
    String email = normalize(body.email());
    ClientAccount a = accounts.findById(email).orElse(null);
    Instant now = clock.instant();
    if (a == null) throw unauthorized("이메일이나 비밀번호가 맞지 않아요. 다시 확인해 주세요.");
    if (a.getLockedUntil() != null && a.getLockedUntil().isAfter(now)) {
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "로그인에 여러 번 실패해 15분 동안 막혔어요. 잠시 뒤에 다시 해 주세요.");
    }
    if (body.password() == null || !encoder.matches(body.password(), a.getPasswordHash())) {
      int fails = a.getFailedCount() + 1;
      a.setFailedCount(fails >= MAX_FAILS ? 0 : fails);
      if (fails >= MAX_FAILS) a.setLockedUntil(now.plus(LOCK));
      accounts.save(a);
      throw unauthorized("이메일이나 비밀번호가 맞지 않아요. 다시 확인해 주세요.");
    }
    if (a.getVerifiedAt() == null) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "아직 이메일 인증을 하지 않았어요. 받은 메일의 링크를 눌러 주세요.");
    }
    requireClient(email);
    a.setFailedCount(0);
    a.setLockedUntil(null);
    accounts.save(a);
    return Map.of("email", email);
  }

  /** 가입 여부를 드러내지 않으려고 언제나 성공으로 답한다. */
  @PostMapping("/reset-request")
  @Transactional
  public Map<String, Boolean> resetRequest(@RequestBody EmailRequest body) {
    String email = normalize(body.email());
    if (accounts.existsById(email)) {
      String link = webBase + "/reset-password?token=" + issue(email, RESET, RESET_TTL);
      mailer.send(email, "[AdFlow] 비밀번호 재설정",
          "아래 링크에서 새 비밀번호를 정해 주세요. 링크는 30분 동안 한 번만 쓸 수 있어요.\n\n" + link
              + "\n\n요청한 적이 없다면 이 메일은 무시해 주세요. 비밀번호는 바뀌지 않아요.");
    }
    return Map.of("ok", true);
  }

  @PostMapping("/reset")
  @Transactional
  public Map<String, Boolean> reset(@RequestBody ResetRequest body) {
    checkPassword(body.password());
    EmailToken t = use(body.token(), RESET, "재설정 링크가 만료됐거나 이미 쓴 링크예요. 비밀번호 찾기를 다시 해 주세요.");
    ClientAccount a = accounts.findById(t.getEmail()).orElseThrow(() -> bad("가입 정보를 찾지 못했어요."));
    a.setPasswordHash(encoder.encode(body.password()));
    // 메일함으로 확인했으니 인증도 된 것이고, 잠금도 푼다.
    if (a.getVerifiedAt() == null) a.setVerifiedAt(clock.instant());
    a.setFailedCount(0);
    a.setLockedUntil(null);
    accounts.save(a);
    return Map.of("ok", true);
  }

  /** 카카오·구글 로그인 전에 묻는다 — 고객으로 등록한 이메일만 들어온다. */
  @PostMapping("/client-check")
  public Map<String, Boolean> clientCheck(@RequestBody EmailRequest body) {
    requireClient(normalize(body.email()));
    return Map.of("ok", true);
  }

  private void requireClient(String email) {
    boolean client =
        members.findById(email).filter(m -> !m.isRemoved() && m.getRole() == Role.CLIENT).isPresent();
    if (!client) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "고객으로 등록되지 않은 이메일이에요. 담당자에게 이 이메일을 등록해 달라고 요청해 주세요.");
    }
  }

  private String issue(String email, String purpose, Duration ttl) {
    byte[] raw = new byte[32];
    RANDOM.nextBytes(raw);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
    tokens.save(new EmailToken(hash(token), email, purpose, clock.instant().plus(ttl)));
    return token;
  }

  private EmailToken use(String token, String purpose, String expired) {
    if (token == null || token.isBlank()) throw bad(expired);
    EmailToken t = tokens.findById(hash(token)).orElseThrow(() -> bad(expired));
    if (!purpose.equals(t.getPurpose()) || t.getUsedAt() != null || t.getExpiresAt().isBefore(clock.instant())) {
      throw bad(expired);
    }
    t.setUsedAt(clock.instant());
    tokens.save(t);
    return t;
  }

  /** 8자 이상, 영문과 숫자를 모두 넣는다 (정책서 3.1). */
  static void checkPassword(String p) {
    if (p == null || p.length() < 8 || !p.matches(".*[A-Za-z].*") || !p.matches(".*[0-9].*")) {
      throw bad("비밀번호는 8자 이상이고 영문과 숫자를 모두 넣어 주세요.");
    }
  }

  private static String normalize(String email) {
    if (email == null || !email.contains("@")) throw bad("이메일 주소를 확인해 주세요.");
    return email.trim().toLowerCase();
  }

  private static String hash(String token) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  private static ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }

  private static ResponseStatusException unauthorized(String message) {
    return new ResponseStatusException(HttpStatus.UNAUTHORIZED, message);
  }
}
