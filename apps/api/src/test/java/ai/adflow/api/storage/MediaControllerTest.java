package ai.adflow.api.storage;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** 인스타그램 게시용 미디어 — 직원이 올리고, Meta 는 로그인 없이 가져간다. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MediaControllerTest {

  @Autowired private MockMvc mockMvc;

  private static final String NAME = "0b6c1f0e-1d2a-4b5c-9d8e-7f6a5b4c3d2e.png";
  private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};

  private static RequestPostProcessor staff() {
    return jwt().jwt(j -> j.subject("media@example.com")).authorities(new SimpleGrantedAuthority("ROLE_LEAD"));
  }

  @Test
  void 직원이_올리면_로그인_없이_공개_주소로_읽힌다() throws Exception {
    mockMvc.perform(put("/media/" + NAME).with(staff()).contentType("image/png").content(PNG)).andExpect(status().isOk());
    mockMvc
        .perform(get("/public/media/" + NAME))
        .andExpect(status().isOk())
        .andExpect(header().string("Content-Type", "image/png"))
        .andExpect(content().bytes(PNG));
  }

  @Test
  void 로그인하지_않으면_올릴_수_없고_고객도_올릴_수_없다() throws Exception {
    mockMvc.perform(put("/media/" + NAME).contentType("image/png").content(PNG)).andExpect(status().isUnauthorized());
    mockMvc
        .perform(put("/media/" + NAME)
            .with(jwt().jwt(j -> j.subject("c@example.com")).authorities(new SimpleGrantedAuthority("ROLE_CLIENT")))
            .contentType("image/png").content(PNG))
        .andExpect(status().isForbidden());
  }

  @Test
  void 이름과_형식이_맞지_않으면_거절한다() throws Exception {
    mockMvc.perform(put("/media/../etc.png").with(staff()).contentType("image/png").content(PNG)).andExpect(status().is4xxClientError());
    mockMvc.perform(put("/media/" + NAME).with(staff()).contentType("video/mp4").content(PNG)).andExpect(status().isBadRequest());
    mockMvc.perform(get("/public/media/not-a-uuid.png")).andExpect(status().isBadRequest());
  }
}
