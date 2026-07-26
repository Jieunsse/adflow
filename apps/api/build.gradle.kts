plugins {
	java
	id("org.springframework.boot") version "4.1.0"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "ai.adflow"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

sourceSets {
	test {
		resources {
			// 골든 픽스처 (설계 §8) — TS 와 **같은 파일**을 읽어야 두 엔진의 동등성이 증명된다.
			// 복사본을 두면 한쪽만 갱신되는 순간 검증이 거짓말을 시작한다.
			srcDir("../../packages/contracts/fixtures")
		}
	}
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.6")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
	runtimeOnly("org.postgresql:postgresql")
	testRuntimeOnly("com.h2database:h2")
	testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testImplementation("org.springframework.security:spring-security-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

testing {
	suites {
		// Testcontainers 통합 테스트. 기본 `test` 와 분리해 ./gradlew test 가 Docker 없이 돌게 둔다.
		// check 에 걸지 않는다 — 걸면 Docker 없는 환경에서 check 가 깨진다.
		val integrationTest by registering(JvmTestSuite::class) {
			useJUnitJupiter()
			dependencies {
				// io.spring.dependency-management 는 표준 configuration 에만 붙는다.
				// 새 스위트에는 BOM 을 직접 얹어야 testcontainers 버전이 해석된다.
				implementation(platform(org.springframework.boot.gradle.plugin.SpringBootPlugin.BOM_COORDINATES))
				implementation(project())
				implementation("org.springframework.boot:spring-boot-starter-webmvc")
				implementation("org.springframework.boot:spring-boot-starter-data-jpa")
				implementation("org.springframework.boot:spring-boot-starter-webmvc-test")
				implementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
				implementation("org.springframework.security:spring-security-test")
				implementation("org.springframework.boot:spring-boot-testcontainers")
				// Testcontainers 2.x 아티팩트 이름. 1.x 의 junit-jupiter·postgresql 은 해석 실패한다.
				implementation("org.testcontainers:testcontainers-junit-jupiter")
				implementation("org.testcontainers:testcontainers-postgresql")
				runtimeOnly("org.postgresql:postgresql")
			}
		}
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
}
