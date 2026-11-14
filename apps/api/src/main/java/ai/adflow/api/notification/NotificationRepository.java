package ai.adflow.api.notification;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, String> {

  List<Notification> findTop100ByRecipientEmailAndCreatedAtAfterOrderByCreatedAtDesc(
      String recipientEmail, Instant after);

  boolean existsByRecipientEmailAndDedupeKey(String recipientEmail, String dedupeKey);

  @Modifying
  @Query("update Notification n set n.readAt = :now where n.recipientEmail = :email and n.readAt is null")
  int markAllRead(@Param("email") String email, @Param("now") Instant now);
}
