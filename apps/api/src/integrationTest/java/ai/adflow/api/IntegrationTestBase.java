package ai.adflow.api;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * 실제 Postgres 16 위에서 도는 통합 테스트의 공통 바탕.
 *
 * static 컨테이너라 이 클래스를 상속한 모든 IT 가 컨테이너 하나를 공유한다 — 테스트마다
 * 컨테이너를 새로 띄우면 통합 스위트 전체가 분 단위로 늘어난다.
 *
 * Testcontainers 2.x 주의 — PostgreSQLContainer 는 org.testcontainers.postgresql 에 있고
 * 더 이상 제네릭이 아니다. `new PostgreSQLContainer<>(...)` 는 컴파일되지 않는다.
 */
@SpringBootTest
@Testcontainers
@ActiveProfiles("integration")
public abstract class IntegrationTestBase {

  @Container
  @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");
}
