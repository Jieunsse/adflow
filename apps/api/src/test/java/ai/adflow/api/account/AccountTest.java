package ai.adflow.api.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** 고객 이메일 가입·인증·로그인 잠금·비밀번호 재설정 (정책서 3.1). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(AccountTest.Stubs.class)
class AccountTest {

  static class StubMailer extends Mailer {
    static final List<String> sent = new ArrayList<>();

    StubMailer() {
      super("", "");
    }

    @Override
    public void send(String to, String subject, String text) {
      sent.add(to + "\n" + text);
    }

    static String lastToken(String to) {
      String last = sent.stream().filter(m -> m.startsWith(to + "\n")).reduce((a, b) -> b).orElseThrow();
      Matcher m = Pattern.compile("token=([A-Za-z0-9_-]+)").matcher(last);
      assertThat(m.find()).isTrue();
      return m.group(1);
    }
  }

  @TestConfiguration
  static class Stubs {
    @Bean
    @Primary
    Mailer stubMailer() {
      return new StubMailer();
    }
  }

  private static final String SECRET = "test-internal-secret";

  @Autowired private MockMvc mockMvc;

  private ResultActions call(String path, String json) throws Exception {
    return mockMvc.perform(
        post("/auth/account" + path).header("X-Internal-Secret", SECRET).contentType(MediaType.APPLICATION_JSON).content(json));
  }

  private void registerClient(String lead, String email) throws Exception {
    mockMvc
        .perform(post("/stores/brand-profiles")
            .with(jwt().jwt(j -> j.subject(lead)).authorities(new SimpleGrantedAuthority("ROLE_LEAD")))
            .contentType(MediaType.APPLICATION_JSON).content("{\"item\":{\"id\":\"bp_" + email.hashCode() + "\",\"name\":\"꽃\"}}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(post("/workspace/members")
            .with(jwt().jwt(j -> j.subject(lead)).authorities(new SimpleGrantedAuthority("ROLE_LEAD")))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + email + "\",\"role\":\"고객\",\"brandProfileId\":\"bp_" + email.hashCode() + "\"}"))
        .andExpect(status().isOk());
  }

  private static String signup(String email, String password) {
    return "{\"email\":\"" + email + "\",\"password\":\"" + password
        + "\",\"agreeTerms\":true,\"agreePrivacy\":true,\"over14\":true}";
  }

  private static String login(String email, String password) {
    return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
  }

  @Test
  void 시크릿이_없으면_부를_수_없다() throws Exception {
    mockMvc
        .perform(post("/auth/account/login").contentType(MediaType.APPLICATION_JSON).content(login("a@b.com", "x")))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 고객으로_등록되지_않은_이메일은_가입할_수_없다() throws Exception {
    call("/signup", signup("stranger@acc.com", "abcd1234"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error").value("고객으로 등록되지 않은 이메일이에요. 담당자에게 이 이메일을 등록해 달라고 요청해 주세요."));
  }

  @Test
  void 인증_메일의_링크를_눌러야_로그인되고_링크는_한_번만_쓴다() throws Exception {
    registerClient("acc1lead@example.com", "kim@acc1.com");
    call("/signup", signup("kim@acc1.com", "short")).andExpect(status().isBadRequest());
    call("/signup", "{\"email\":\"kim@acc1.com\",\"password\":\"abcd1234\",\"agreeTerms\":true,\"agreePrivacy\":false,\"over14\":true}")
        .andExpect(status().isBadRequest());
    call("/signup", signup("KIM@acc1.com", "abcd1234")).andExpect(status().isOk());

    call("/login", login("kim@acc1.com", "abcd1234"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error").value("아직 이메일 인증을 하지 않았어요. 받은 메일의 링크를 눌러 주세요."));

    String token = StubMailer.lastToken("kim@acc1.com");
    call("/verify", "{\"token\":\"" + token + "\"}").andExpect(status().isOk());
    call("/verify", "{\"token\":\"" + token + "\"}").andExpect(status().isBadRequest());

    call("/login", login("kim@acc1.com", "abcd1234")).andExpect(jsonPath("$.email").value("kim@acc1.com"));
    call("/signup", signup("kim@acc1.com", "abcd1234")).andExpect(status().isConflict());
  }

  @Test
  void 다섯_번_틀리면_맞는_비밀번호도_15분_동안_막고_재설정하면_풀린다() throws Exception {
    registerClient("acc2lead@example.com", "lee@acc2.com");
    call("/signup", signup("lee@acc2.com", "abcd1234")).andExpect(status().isOk());
    call("/verify", "{\"token\":\"" + StubMailer.lastToken("lee@acc2.com") + "\"}").andExpect(status().isOk());

    for (int i = 0; i < 5; i++) call("/login", login("lee@acc2.com", "wrong1234")).andExpect(status().isUnauthorized());
    call("/login", login("lee@acc2.com", "abcd1234"))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.error").value("로그인에 여러 번 실패해 15분 동안 막혔어요. 잠시 뒤에 다시 해 주세요."));

    call("/reset-request", "{\"email\":\"lee@acc2.com\"}").andExpect(status().isOk());
    call("/reset", "{\"token\":\"" + StubMailer.lastToken("lee@acc2.com") + "\",\"password\":\"newpass99\"}")
        .andExpect(status().isOk());
    call("/login", login("lee@acc2.com", "newpass99")).andExpect(status().isOk());

    // 모르는 이메일의 재설정 요청도 성공으로 답한다 — 가입 여부를 드러내지 않는다.
    call("/reset-request", "{\"email\":\"nobody@acc2.com\"}").andExpect(status().isOk());
  }

  @Test
  void 고객_로그인_교환은_새_워크스페이스를_만들지_않는다() throws Exception {
    mockMvc
        .perform(post("/auth/exchange").header("X-Internal-Secret", SECRET).contentType(MediaType.APPLICATION_JSON)
            .content("{\"ownerKey\":\"google-user@gmail.com\",\"email\":\"google-user@gmail.com\",\"client\":true}"))
        .andExpect(status().isForbidden());

    registerClient("acc3lead@example.com", "park@acc3.com");
    mockMvc
        .perform(post("/auth/exchange").header("X-Internal-Secret", SECRET).contentType(MediaType.APPLICATION_JSON)
            .content("{\"ownerKey\":\"park@acc3.com\",\"email\":\"park@acc3.com\",\"client\":true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("고객"));
  }
}
