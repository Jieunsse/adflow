package ai.adflow.api.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * `packages/contracts/openapi.json` 스냅샷이 현재 컨트롤러와 어긋나면 깨진다.
 *
 * <p>프론트 타입(`packages/contracts/types/api.d.ts`)이 이 스냅샷에서 생성되므로, 계약이 바뀌었는데
 * 스냅샷을 갱신하지 않으면 <b>"OpenAPI 변경 → 프론트 컴파일 실패"라는 안전장치(설계 §8)가 낡은 파일
 * 위에서 조용히 무력화된다</b>. 드리프트를 잡는 유일한 지점이라 서버를 띄우지 않는 테스트로 둔다 —
 * 스펙 생성은 `npm run contracts:generate` 가 Spring 기동을 요구하므로 아무도 상시로 돌리지 않는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpenApiSnapshotTest {

  private static final String REGENERATE =
      "스펙이 바뀌었으면 `cd apps/api && ./gradlew bootRun` 으로 띄운 뒤 "
          + "`npm run contracts:generate` 로 openapi.json·types/api.d.ts 를 함께 갱신하세요.";

  private static final JsonMapper MAPPER = JsonMapper.builder().build();

  @Autowired private MockMvc mockMvc;

  @Test
  void 커밋된_OpenAPI_스냅샷이_현재_컨트롤러와_같다() throws Exception {
    JsonNode live =
        MAPPER.readTree(
            mockMvc
                .perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    JsonNode snapshot = MAPPER.readTree(Files.readString(snapshotPath()));

    // 오퍼레이션 목록을 먼저 비교한다 — 엔드포인트 추가·삭제가 가장 흔한 드리프트이고,
    // 문서 전체 비교는 실패 메시지가 수천 줄이라 무엇이 갈라졌는지 안 보인다.
    assertThat(operations(live))
        .as("엔드포인트 목록이 스냅샷과 다릅니다. " + REGENERATE)
        .containsExactlyElementsOf(operations(snapshot));

    assertThat(withoutServers(live))
        .as("엔드포인트 목록은 같지만 스키마·파라미터가 스냅샷과 다릅니다. " + REGENERATE)
        .isEqualTo(withoutServers(snapshot));
  }

  /** `METHOD path` 정렬 목록. */
  private static List<String> operations(JsonNode doc) {
    List<String> ops = new ArrayList<>();
    JsonNode paths = doc.path("paths");
    for (Iterator<Map.Entry<String, JsonNode>> it = paths.properties().iterator(); it.hasNext(); ) {
      Map.Entry<String, JsonNode> path = it.next();
      path.getValue().propertyNames().forEach(method -> ops.add(method.toUpperCase() + " " + path.getKey()));
    }
    return ops.stream().sorted().toList();
  }

  /**
   * `servers` 는 기동 환경이 채운다 — MockMvc 는 포트가 없고 `bootRun` 은 8080 이다. 계약의 실체가
   * 아니므로 비교에서 뺀다.
   */
  private static JsonNode withoutServers(JsonNode doc) {
    ObjectNode copy = (ObjectNode) doc.deepCopy();
    copy.remove("servers");
    return copy;
  }

  /** 테스트 작업 디렉터리는 `apps/api` 다. 레포 위치가 바뀌어도 버티게 위로 올라가며 찾는다. */
  private static Path snapshotPath() {
    Path dir = Path.of("").toAbsolutePath();
    for (int depth = 0; depth < 5 && dir != null; depth++, dir = dir.getParent()) {
      Path candidate = dir.resolve("packages/contracts/openapi.json");
      if (Files.exists(candidate)) {
        return candidate;
      }
    }
    throw new IllegalStateException(
        "packages/contracts/openapi.json 을 찾지 못했어요 (작업 디렉터리: "
            + Path.of("").toAbsolutePath()
            + ")");
  }
}
