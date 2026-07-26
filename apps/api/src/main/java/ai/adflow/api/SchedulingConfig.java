package ai.adflow.api;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 폴러 스케줄 (설계 §6). 테스트 프로필은 끈다 — 컨텍스트가 뜨자마자 한 바퀴 도는 것이 테스트의
 * 관심사가 아니고, 실행 순서에 따라 다른 테스트의 상태를 건드릴 수 있다.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.poller.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {}
