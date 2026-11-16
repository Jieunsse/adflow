package ai.adflow.api.client;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Service;

/** 청구 계산과 연체 판단 (회계 문서 2.2·2.3). */
@Service
public class Billing {

  static final ZoneId KST = ZoneId.of("Asia/Seoul");
  public static final int BLOCK_AFTER_DAYS = 30;

  private final ClientRepository clients;
  private final ClientBillRepository bills;
  private final Clock clock;

  public Billing(ClientRepository clients, ClientBillRepository bills, Clock clock) {
    this.clients = clients;
    this.bills = bills;
    this.clock = clock;
  }

  /** 해지 정산 결과. lastContractMonth 까지 청구하고, 첫 3개월 전 해지면 첫 달 할인분(clawback)을 더한다. */
  public record Settlement(String effectiveEnd, int lastContractMonth, long clawback) {}

  /**
   * 해지를 알린 날과 원하는 종료일로 마지막 청구를 계산한다. 30일 전에 알리지 않았으면 알린 날부터 30일이 되는 날이
   * 속한 계약 월까지 청구한다. 첫 3개월을 채우지 않으면 첫 달 할인분(정가의 50%)을 더한다.
   */
  public static Settlement settle(long monthlyPrice, LocalDate contractStart, LocalDate noticeDate, LocalDate requestedEnd) {
    // "30일 전 통보"를 한 달로 읽는다. 날 수로 세면 2월이 끼는 달에 회계 문서 2.2 의 예시(2개월째 첫날 통보 → 2개월째까지)와 어긋난다.
    LocalDate earliest = noticeDate.plusMonths(1).minusDays(1);
    LocalDate end = requestedEnd.isBefore(earliest) ? earliest : requestedEnd;
    // 계약 월 k 는 contractStart + (k-1)개월에 시작한다. end 가 속한 계약 월까지 청구한다.
    int month = (int) ChronoUnit.MONTHS.between(contractStart, end) + 1;
    long clawback = month < 3 ? monthlyPrice / 2 : 0;
    return new Settlement(end.toString(), month, clawback);
  }

  /** 이 브랜드의 고객사에서 가장 오래 밀린 청구가 기한을 넘긴 날 수. 밀린 것이 없으면 0. */
  public long overdueDays(String workspaceId, String brandId) {
    Client c = clients.findFirstByOwnerKeyAndBrandProfileId(workspaceId, brandId).orElse(null);
    if (c == null) return 0;
    return overdueDays(c);
  }

  long overdueDays(Client c) {
    LocalDate today = LocalDate.now(clock.withZone(KST));
    long worst = 0;
    for (ClientBill b : bills.findByClientIdAndWorkspaceIdOrderByContractMonthAsc(c.getId(), c.getOwnerKey())) {
      if (b.getPaidDate() != null || b.getDueDate() == null) continue;
      worst = Math.max(worst, ChronoUnit.DAYS.between(LocalDate.parse(b.getDueDate()), today));
    }
    return worst;
  }
}
