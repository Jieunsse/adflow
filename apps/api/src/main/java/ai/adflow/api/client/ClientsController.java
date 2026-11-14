package ai.adflow.api.client;

import ai.adflow.api.security.Role;
import ai.adflow.api.store.brand.BrandProfile;
import ai.adflow.api.store.brand.BrandProfileRepository;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.Workspaces;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 고객사 영업·계약·청구 기록 (기능 14, 정책서 27절). 영업 기록은 직원 모두, 청구는 팀장만 본다.
 *
 * <p>shortcut: 연락처·메모 1년 뒤 삭제, 진단 데이터 30일 뒤 삭제는 아직 하지 않는다. 정리 작업을 만들 때 넣는다.
 */
@RestController
@RequestMapping("/clients")
public class ClientsController {

  /** 목록 한 줄. 청구 금액은 빼고 연체 여부만 싣는다 — 담당 직원은 연체 상태만 본다. */
  public record ClientView(Client client, boolean overdue) {}

  public record StageRequest(String stage) {}

  public record MemoRequest(String body) {}

  private static final Set<String> STAGES =
      Set.of(Client.INQUIRY, Client.CONSULT, Client.PROPOSAL, Client.CONTRACT, Client.RENEWAL, Client.ENDED);

  private final ClientRepository clients;
  private final ClientMemoRepository memos;
  private final ClientBillRepository bills;
  private final BrandProfileRepository profiles;
  private final Billing billing;
  private final Workspaces workspaces;
  private final Clock clock;

  public ClientsController(
      ClientRepository clients,
      ClientMemoRepository memos,
      ClientBillRepository bills,
      BrandProfileRepository profiles,
      Billing billing,
      Workspaces workspaces,
      Clock clock) {
    this.clients = clients;
    this.memos = memos;
    this.bills = bills;
    this.profiles = profiles;
    this.billing = billing;
    this.workspaces = workspaces;
    this.clock = clock;
  }

  @GetMapping
  public Map<String, List<ClientView>> list(@AuthenticationPrincipal Jwt jwt) {
    String ws = workspaces.idOf(jwt);
    return Map.of(
        "items",
        clients.findByOwnerKeyOrderByUpdatedAtDesc(ws).stream()
            .map(c -> new ClientView(c, billing.overdueDays(c) > 0))
            .toList());
  }

  @GetMapping("/{id}")
  public ClientView get(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    Client c = load(workspaces.idOf(jwt), id);
    return new ClientView(c, billing.overdueDays(c) > 0);
  }

  /** 새 고객사는 "문의"로 시작한다. 단계는 /stage 로만 바꾼다. */
  @PostMapping
  @Transactional
  public Client create(@AuthenticationPrincipal Jwt jwt, @RequestBody Client body) {
    Member me = workspaces.current(jwt.getSubject());
    if (body.getName() == null || body.getName().isBlank()) throw bad("고객사 이름을 적어 주세요.");
    Client c = new Client();
    c.setId("cl_" + UUID.randomUUID());
    c.setOwnerKey(me.getWorkspaceId());
    c.setStage(Client.INQUIRY);
    c.setCreatedAt(clock.instant().toString());
    if (body.getManagerEmail() == null) c.setManagerEmail(me.getEmail());
    copy(body, c);
    c.setUpdatedAt(clock.instant());
    return clients.save(c);
  }

  /** 개요·계약 칸을 고친다. 단계와 만든 브랜드는 여기서 바꾸지 않는다. */
  @PutMapping("/{id}")
  @Transactional
  public Client update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody Client body) {
    Client c = load(workspaces.idOf(jwt), id);
    copy(body, c);
    c.setUpdatedAt(clock.instant());
    return clients.save(c);
  }

  /** "계약"으로 바꾸면 같은 이름의 브랜드를 만든다 (정책서 27절, 기능 10 흐름 1). */
  @PostMapping("/{id}/stage")
  @Transactional
  public Client changeStage(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody StageRequest body) {
    Client c = load(workspaces.idOf(jwt), id);
    String to = body.stage();
    if (to == null || !STAGES.contains(to)) throw bad("고객사 단계를 다시 골라 주세요.");
    if (Client.CONSULT.equals(to) && Boolean.TRUE.equals(c.getExcludedIndustry())) {
      throw bad("받지 않는 업종으로 표시한 고객사라 상담으로 넘길 수 없어요. 업종 표시를 확인해 주세요.");
    }
    if (Client.CONTRACT.equals(to) && c.getBrandProfileId() == null) {
      BrandProfile brand = new BrandProfile();
      brand.setId("bp-" + UUID.randomUUID());
      brand.setOwnerKey(c.getOwnerKey());
      brand.setName(c.getName());
      brand.setUpdatedAt(clock.instant());
      profiles.save(brand);
      c.setBrandProfileId(brand.getId());
    }
    c.setStage(to);
    c.setUpdatedAt(clock.instant());
    return clients.save(c);
  }

  @GetMapping("/{id}/memos")
  public Map<String, List<ClientMemo>> memos(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    String ws = workspaces.idOf(jwt);
    load(ws, id);
    return Map.of("items", memos.findByClientIdAndWorkspaceIdOrderByCreatedAtAsc(id, ws));
  }

  @PostMapping("/{id}/memos")
  @Transactional
  public ClientMemo addMemo(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody MemoRequest body) {
    Member me = workspaces.current(jwt.getSubject());
    load(me.getWorkspaceId(), id);
    if (body.body() == null || body.body().isBlank()) throw bad("메모 내용을 적어 주세요.");
    return memos.save(
        new ClientMemo(
            "cm_" + UUID.randomUUID(), id, me.getWorkspaceId(), me.getEmail(), body.body().trim(), clock.instant().toString()));
  }

  /* ─── 청구 (팀장만) ─────────────────────────────────────── */

  @GetMapping("/{id}/bills")
  public Map<String, List<ClientBill>> bills(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    Member me = requireLead(jwt);
    load(me.getWorkspaceId(), id);
    return Map.of("items", bills.findByClientIdAndWorkspaceIdOrderByContractMonthAsc(id, me.getWorkspaceId()));
  }

  /** 청구 한 건을 넣거나 고친다. id 가 없으면 새로 만든다. "입금 확인"은 paidDate 를 채워 보내는 것이다. */
  @PutMapping("/{id}/bills")
  @Transactional
  public ClientBill saveBill(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody ClientBill body) {
    Member me = requireLead(jwt);
    load(me.getWorkspaceId(), id);
    if (body.getContractMonth() == null || body.getContractMonth() < 1) throw bad("몇 번째 계약 월인지 적어 주세요.");
    for (String d : new String[] {body.getBillDate(), body.getDueDate(), body.getPaidDate()}) checkDate(d);
    ClientBill b =
        body.getId() == null
            ? new ClientBill()
            : bills.findById(body.getId())
                .filter(x -> x.getClientId().equals(id) && x.getWorkspaceId().equals(me.getWorkspaceId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "청구 기록을 찾지 못했어요."));
    if (b.getId() == null) b.setId("cb_" + UUID.randomUUID());
    b.setClientId(id);
    b.setWorkspaceId(me.getWorkspaceId());
    b.setContractMonth(body.getContractMonth());
    b.setBillDate(body.getBillDate());
    b.setAmount(body.getAmount());
    b.setDiscount(body.getDiscount());
    b.setDueDate(body.getDueDate());
    b.setPaidDate(body.getPaidDate());
    b.setTaxInvoiceNo(body.getTaxInvoiceNo());
    return bills.save(b);
  }

  /** 해지를 알린 날과 원하는 종료일로 마지막 청구를 계산해 보여 준다 (회계 문서 2.2). 저장하지 않는다. */
  @GetMapping("/{id}/settlement")
  public Billing.Settlement settlement(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable String id,
      @RequestParam("noticeDate") String noticeDate,
      @RequestParam("endDate") String endDate) {
    Member me = requireLead(jwt);
    Client c = load(me.getWorkspaceId(), id);
    if (c.getContractStart() == null || c.getMonthlyPrice() == null) {
      throw bad("계약 시작일과 월 정가를 먼저 적어 주세요.");
    }
    checkDate(noticeDate);
    checkDate(endDate);
    return Billing.settle(
        c.getMonthlyPrice(), LocalDate.parse(c.getContractStart()), LocalDate.parse(noticeDate), LocalDate.parse(endDate));
  }

  private Member requireLead(Jwt jwt) {
    Member me = workspaces.current(jwt.getSubject());
    if (me.getRole() != Role.LEAD) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "청구 기록은 팀장만 볼 수 있어요.");
    }
    return me;
  }

  private Client load(String ws, String id) {
    return clients
        .findById(id)
        .filter(c -> ws.equals(c.getOwnerKey()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "고객사를 찾지 못했어요."));
  }

  private static void copy(Client from, Client to) {
    if (from.getName() != null && !from.getName().isBlank()) to.setName(from.getName().trim());
    to.setContact(from.getContact());
    to.setIndustry(from.getIndustry());
    to.setInquirySource(from.getInquirySource());
    if (from.getManagerEmail() != null) to.setManagerEmail(from.getManagerEmail());
    to.setNextAction(from.getNextAction());
    checkDate(from.getNextActionDate());
    to.setNextActionDate(from.getNextActionDate());
    to.setCaseStudyConsent(from.getCaseStudyConsent());
    to.setExcludedIndustry(from.getExcludedIndustry());
    to.setProduct(from.getProduct());
    to.setBillingType(from.getBillingType());
    to.setMonthlyPrice(from.getMonthlyPrice());
    for (String d : new String[] {from.getContractStart(), from.getContractEnd(), from.getCancelNoticeDate(), from.getCancelDate()}) {
      checkDate(d);
    }
    to.setContractStart(from.getContractStart());
    to.setContractEnd(from.getContractEnd());
    to.setCancelNoticeDate(from.getCancelNoticeDate());
    to.setCancelDate(from.getCancelDate());
  }

  private static void checkDate(String d) {
    if (d == null || d.isBlank()) return;
    try {
      LocalDate.parse(d);
    } catch (DateTimeParseException e) {
      throw bad("날짜는 2026-12-01 형식으로 적어 주세요.");
    }
  }

  private static ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
