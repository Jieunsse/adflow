package ai.adflow.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

// H2 인메모리로 띄운다 — 테스트가 Docker Postgres 에 의존하지 않게 한다.
@SpringBootTest
@ActiveProfiles("test")
class ApiApplicationTests {

	@Test
	void contextLoads() {
	}

}
