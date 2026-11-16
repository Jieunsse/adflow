package ai.adflow.api;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * 실제 Postgres 16 위에서 도는 통합 테스트의 공통 바탕.
 *
 * 싱글턴 컨테이너 패턴이다 — @Testcontainers/@Container 를 쓰지 않고 static 초기화로 직접 띄운다.
 * JUnit 의 @Container 생명주기는 테스트 클래스가 끝날 때 컨테이너를 멈추는데 static 필드는 JVM
 * 전체에서 공유되므로, 두 번째 IT 클래스가 이미 멈춘 컨테이너의 포트에 붙어 Connection refused 로
 * 죽는다. 여기서는 멈추지 않고 JVM 종료 시 Ryuk 이 정리하게 둔다.
 *
 * Testcontainers 2.x 주의 — PostgreSQLContainer 는 org.testcontainers.postgresql 에 있고
 * 더 이상 제네릭이 아니다. `new PostgreSQLContainer<>(...)` 는 컴파일되지 않는다.
 */
@SpringBootTest
@ActiveProfiles("integration")
public abstract class IntegrationTestBase {

  @ServiceConnection
  static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");

  static {
    postgres.start();
  }
}
