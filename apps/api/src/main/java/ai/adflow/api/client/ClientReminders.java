package ai.adflow.api.client;

import ai.adflow.api.notification.Notifications;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 매일 아침 고객사 알림 (정책서 27절, 회계 문서 2.3). 계약 종료 14일 전이면 "재계약 대기"로 바꾸고, 입금 기한을
 * 넘긴 청구가 있으면 담당 직원과 팀장에게 알린다. 같은 일로는 한 번만 알린다(알림 중복 키).
 */
@Component
public class ClientReminders {

  private static final Logger log = LoggerFactory.getLogger(ClientReminders.class);

  private final ClientRepository clients;
  private final ClientBillRepository bills;
  private final Notifications notifications;
  private final Clock clock;

  public ClientReminders(
      ClientRepository clients, ClientBillRepository bills, Notifications notifications, Clock clock) {
    this.clients = clients;
    this.bills = bills;
    this.notifications = notifications;
    this.clock = clock;
  }

  @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
  public void scheduled() {
    try {
      runOnce();
    } catch (RuntimeException e) {
      log.warn("고객사 알림을 돌리지 못했어요: {}", e.getMessage());
    }
  }

  public void runOnce() {
    LocalDate today = LocalDate.now(clock.withZone(Billing.KST));
    for (Client c : clients.findByStage(Client.CONTRACT)) {
      if (c.getContractEnd() == null || LocalDate.parse(c.getContractEnd()).isAfter(today.plusDays(14))) continue;
      c.setStage(Client.RENEWAL);
      c.setUpdatedAt(clock.instant());
      clients.save(c);
      notifications.send(
          to(c), c.getOwnerKey(), "client-renewal",
          "'" + Notifications.name(c.getName()) + "' 계약이 " + c.getContractEnd() + "에 끝나요. 재계약을 이야기해 주세요.",
          "/clients/" + c.getId(), "renewal:" + c.getId() + ":" + c.getContractEnd());
    }
    for (ClientBill b : bills.findByPaidDateIsNull()) {
      if (b.getDueDate() == null || !LocalDate.parse(b.getDueDate()).isBefore(today)) continue;
      Client c = clients.findById(b.getClientId()).orElse(null);
      if (c == null) continue;
      notifications.send(
          to(c), c.getOwnerKey(), "client-overdue",
          "'" + Notifications.name(c.getName()) + "' " + b.getContractMonth() + "개월째 입금이 늦어지고 있어요.",
          "/clients/" + c.getId(), "overdue:" + b.getId());
    }
  }

  private List<String> to(Client c) {
    List<String> to = new ArrayList<>(notifications.leads(c.getOwnerKey()));
    if (c.getManagerEmail() != null) to.add(c.getManagerEmail());
    return to;
  }
}
