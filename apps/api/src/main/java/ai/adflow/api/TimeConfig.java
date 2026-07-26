package ai.adflow.api;

import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 시계를 빈으로 뺀다 — 게재 요청의 start_time·end_time 이 "오늘"에서 파생되므로 테스트가 시각을
 * 고정할 수 있어야 골든 픽스처가 매일 깨지지 않는다. TS 쪽은 vi.setSystemTime 이 하는 일이다.
 */
@Configuration
public class TimeConfig {

  @Bean
  @ConditionalOnMissingBean
  Clock clock() {
    return Clock.systemUTC();
  }
}
