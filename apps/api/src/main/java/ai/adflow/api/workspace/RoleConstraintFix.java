package ai.adflow.api.workspace;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Hibernate 가 역할 칸(members.role, meta_connections.role)에 만든 CHECK 제약(역할 목록)을 지운다. ddl-auto update 는 이 제약을 고치지 않아서,
 * 역할을 새로 더하면(CLIENT) 기존 DB 에 그 역할을 넣을 때 500 이 난다. 역할 값은 Role enum 이 이미 검사한다.
 *
 * <p>shortcut: 기동할 때마다 도는 수동 마이그레이션이다. Flyway 를 들이면(설계 §10) 마이그레이션 파일로 옮기고 지운다.
 */
@Component
public class RoleConstraintFix implements ApplicationRunner {

  private final JdbcTemplate jdbc;

  public RoleConstraintFix(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  public void run(ApplicationArguments args) {
    jdbc.execute("alter table if exists members drop constraint if exists members_role_check");
    jdbc.execute("alter table if exists meta_connections drop constraint if exists meta_connections_role_check");
  }
}
