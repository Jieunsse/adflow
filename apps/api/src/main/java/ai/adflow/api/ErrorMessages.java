package ai.adflow.api;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * 컨트롤러가 직접 던진 거절 이유를 화면 문구로 내보낸다 ({"error": "..."}). 웹은 이 문구를 그대로 보여 준다.
 *
 * <p>ResponseStatusException 만 다룬다. 그 이유는 사람에게 보이라고 쓴 문구다. 다른 예외의 메시지는 내부
 * 정보일 수 있어 기본 오류 응답 그대로 둔다.
 */
@RestControllerAdvice
public class ErrorMessages {

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> reason(ResponseStatusException e) {
    String reason = e.getReason() == null ? "요청을 처리하지 못했어요." : e.getReason();
    return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", reason));
  }
}
