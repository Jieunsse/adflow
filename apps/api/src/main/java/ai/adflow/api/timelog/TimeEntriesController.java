package ai.adflow.api.timelog;

import ai.adflow.api.security.Role;
import ai.adflow.api.store.brand.BrandProfileRepository;
import ai.adflow.api.workspace.Member;
import ai.adflow.api.workspace.MemberRepository;
import ai.adflow.api.workspace.Workspaces;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * 작업 시간 기록 (기능 15, 정책서 28절). 직원은 이번 주 자기 기록을 남기고 고친다. 팀장은 주간 합계를 본다.
 * 마케터 1명이 맡을 수 있는 고객 수를 재려는 숫자라, 기록이 세 번 누르면 끝나야 한다.
 */
@RestController
@RequestMapping("/time-entries")
public class TimeEntriesController {

  public record EntryRequest(String brandProfileId, String stage, Integer minutes) {}

  /** 한 사람이 한 브랜드에 이번 주 쓴 시간. over 는 역할별 기준(퍼포먼스 2시간, 콘텐츠 1시간)을 넘었는지. */
  public record PersonBrand(String memberEmail, String brandProfileId, int minutes, boolean over) {}

  public record Summary(
      String weekStart,
      Map<String, Integer> byMember,
      Map<String, Integer> byBrand,
      Map<String, Integer> byStage,
      List<PersonBrand> byMemberAndBrand) {}

  static final Set<String> STAGES =
      Set.of("onboarding", "monthly_plan", "creative", "review", "launch", "report", "sales");
  private static final ZoneId KST = ZoneId.of("Asia/Seoul");
  private static final int MAX_MINUTES = 12 * 60;

  private final TimeEntryRepository entries;
  private final MemberRepository members;
  private final BrandProfileRepository profiles;
  private final Workspaces workspaces;
  private final Clock clock;

  public TimeEntriesController(
      TimeEntryRepository entries,
      MemberRepository members,
      BrandProfileRepository profiles,
      Workspaces workspaces,
      Clock clock) {
    this.entries = entries;
    this.members = members;
    this.profiles = profiles;
    this.workspaces = workspaces;
    this.clock = clock;
  }

  /** 이번 주 내 기록. */
  @GetMapping
  public Map<String, List<TimeEntry>> mine(@AuthenticationPrincipal Jwt jwt) {
    Member me = workspaces.current(jwt.getSubject());
    return Map.of("items", thisWeek(me.getWorkspaceId()).stream().filter(e -> e.getMemberEmail().equals(me.getEmail())).toList());
  }

  @PostMapping
  @Transactional
  public TimeEntry add(@AuthenticationPrincipal Jwt jwt, @RequestBody EntryRequest body) {
    Member me = workspaces.current(jwt.getSubject());
    TimeEntry e = new TimeEntry();
    e.setId("te_" + UUID.randomUUID());
    e.setWorkspaceId(me.getWorkspaceId());
    e.setMemberEmail(me.getEmail());
    e.setWorkDate(today().toString());
    apply(me, e, body);
    return entries.save(e);
  }

  /** 이번 주 기록만 고칠 수 있다 (기능명세 15-2). */
  @PutMapping("/{id}")
  @Transactional
  public TimeEntry update(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @RequestBody EntryRequest body) {
    Member me = workspaces.current(jwt.getSubject());
    TimeEntry e = mineThisWeek(me, id);
    apply(me, e, body);
    return entries.save(e);
  }

  @DeleteMapping("/{id}")
  @Transactional
  public Map<String, Boolean> remove(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    Member me = workspaces.current(jwt.getSubject());
    entries.delete(mineThisWeek(me, id));
    return Map.of("ok", true);
  }

  /** 팀장만 — 이번 주 직원별·브랜드별·단계별 합계 (정책서 28절). */
  @GetMapping("/summary")
  public Summary summary(@AuthenticationPrincipal Jwt jwt) {
    Member me = workspaces.current(jwt.getSubject());
    if (me.getRole() != Role.LEAD) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "주간 합계는 팀장만 볼 수 있어요.");
    }
    List<TimeEntry> week = thisWeek(me.getWorkspaceId());
    Map<String, Role> roles =
        members.findByWorkspaceIdAndRemovedAtIsNullOrderByJoinedAtAsc(me.getWorkspaceId()).stream()
            .collect(Collectors.toMap(Member::getEmail, Member::getRole));
    Map<List<String>, Integer> pairs = new TreeMap<>((a, b) -> String.join("|", a).compareTo(String.join("|", b)));
    week.forEach(e -> pairs.merge(List.of(e.getMemberEmail(), e.getBrandProfileId()), e.getMinutes(), Integer::sum));

    return new Summary(
        weekStart().toString(),
        sum(week, TimeEntry::getMemberEmail),
        sum(week, TimeEntry::getBrandProfileId),
        sum(week, TimeEntry::getStage),
        pairs.entrySet().stream()
            .map(p -> new PersonBrand(p.getKey().get(0), p.getKey().get(1), p.getValue(),
                over(roles.get(p.getKey().get(0)), p.getValue())))
            .toList());
  }

  /** 고객 한 곳에 퍼포먼스 마케터(팀원·게재) 주 2시간, 콘텐츠 마케터(팀원·검토) 주 1시간을 넘으면 표시한다. */
  static boolean over(Role role, int minutes) {
    if (role == Role.MEMBER_PUBLISH) return minutes > 120;
    if (role == Role.MEMBER_REVIEW) return minutes > 60;
    return false;
  }

  private void apply(Member me, TimeEntry e, EntryRequest body) {
    if (body.brandProfileId() == null
        || profiles.findById(body.brandProfileId()).filter(p -> me.getWorkspaceId().equals(p.getOwnerKey())).isEmpty()) {
      throw bad("브랜드를 골라 주세요.");
    }
    if (body.stage() == null || !STAGES.contains(body.stage())) throw bad("작업 단계를 골라 주세요.");
    Integer m = body.minutes();
    if (m == null || m <= 0 || m % 15 != 0 || m > MAX_MINUTES) throw bad("시간은 15분 단위로, 12시간까지 적어 주세요.");
    e.setBrandProfileId(body.brandProfileId());
    e.setStage(body.stage());
    e.setMinutes(m);
  }

  private TimeEntry mineThisWeek(Member me, String id) {
    TimeEntry e =
        entries
            .findById(id)
            .filter(x -> x.getWorkspaceId().equals(me.getWorkspaceId()) && x.getMemberEmail().equals(me.getEmail()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "기록을 찾지 못했어요."));
    if (LocalDate.parse(e.getWorkDate()).isBefore(weekStart())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "지난주 기록은 고칠 수 없어요.");
    }
    return e;
  }

  private List<TimeEntry> thisWeek(String ws) {
    return entries.findByWorkspaceIdAndWorkDateBetweenOrderByWorkDateDesc(
        ws, weekStart().toString(), weekStart().plusDays(6).toString());
  }

  private LocalDate today() {
    return LocalDate.now(clock.withZone(KST));
  }

  private LocalDate weekStart() {
    return today().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
  }

  private static Map<String, Integer> sum(List<TimeEntry> week, java.util.function.Function<TimeEntry, String> key) {
    return week.stream().collect(Collectors.groupingBy(key, TreeMap::new, Collectors.summingInt(TimeEntry::getMinutes)));
  }

  private static ResponseStatusException bad(String message) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
  }
}
