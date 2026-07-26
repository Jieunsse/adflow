package ai.adflow.api.meta;

import ai.adflow.api.tournament.engine.AdKpi;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * 라운드 성과 조회. TS: lib/meta-ads-insights.ts 의 getSplitTestResult · getInsights(level=ad).
 *
 * <p>토너먼트가 쓰는 것은 두 갈래뿐이다 — ad study 의 유의성 결과(판정)와 광고별 4필드(표시용). 캠페인
 * 레벨 집계·과금·목표별 액션 추출은 화면 전용이라 TS 에 남는다.
 *
 * <p>파싱이 위험 지점이다. ad study 결과 JSON 은 버전·계정마다 모양 편차가 커서 관대하게 읽어야 하고,
 * 그 관대함이 곧 계약이다 — 골든 픽스처({@code fixtures/meta/insights.json})가 지킨다.
 */
@Component
public class MetaInsightsClient {

  /** null = 스터디 진행 중(결산 보류). winner == null = inconclusive(챔피언 방어). */
  public record StudyResult(String winner, double confidence) {}

  private static final Pattern CELL_A = Pattern.compile("\\bA\\b|^A|CELL A|챔피언");
  private static final Pattern CELL_B = Pattern.compile("\\bB\\b|^B|CELL B|챌린저");

  private final MetaGraphClient graph;

  public MetaInsightsClient(MetaGraphClient graph) {
    this.graph = graph;
  }

  /** ADR §4 정석 — Meta 가 셀별 유의성·winner 를 판정한다. 조회 실패는 "진행 중"으로 접는다. */
  public StudyResult splitTestResult(String studyId, String token) {
    JsonNode data;
    try {
      data = graph.get("/" + studyId + "?fields=id,results,cells{name,results}&access_token=" + token);
    } catch (RuntimeException e) {
      // TS 도 여기서 삼킨다 — 스터디 조회 실패로 결산을 영구히 막지 않는다.
      return null;
    }
    return parseStudy(data);
  }

  static StudyResult parseStudy(JsonNode data) {
    // 결과 엔트리를 전부 모은다 (top-level results + 셀별 results). 셀 이름은 엔트리 자체 또는 부모 셀에서.
    List<String> cells = new ArrayList<>();
    List<JsonNode> entries = new ArrayList<>();

    for (JsonNode e : entryArray(data.get("results"))) {
      cells.add(normalizeCell(firstText(e, "cell", "cell_name", "name")));
      entries.add(e);
    }
    JsonNode cellData = data.path("cells").get("data");
    if (cellData != null && cellData.isArray()) {
      for (JsonNode cell : cellData) {
        String parent = normalizeCell(cell.path("name").asString(null));
        for (JsonNode e : entryArray(cell.get("results"))) {
          String own = normalizeCell(firstText(e, "cell", "cell_name", "name"));
          cells.add(own != null ? own : parent);
          entries.add(e);
        }
      }
    }

    if (entries.isEmpty()) return null; // 결과 미생성 = 스터디 진행 중

    for (int i = 0; i < entries.size(); i++) {
      if (significant(entries.get(i)) && cells.get(i) != null) {
        return new StudyResult(cells.get(i), confidence(entries.get(i), true));
      }
    }

    // 유의 winner 없음 = inconclusive(챔피언 방어). confidence 는 보고된 값 중 최대 또는 0.5.
    double max = 0.5;
    for (JsonNode e : entries) max = Math.max(max, confidence(e, false));
    return new StudyResult(null, max);
  }

  /** 광고별 4필드. 라운드의 셀 A·B 순서를 그대로 따른다 — 응답 행 순서는 믿지 않는다. */
  public List<AdKpi> roundAdKpis(String campaignId, String token, List<String> adIds) {
    if (adIds == null || adIds.size() < 2) return List.of(AdKpi.EMPTY, AdKpi.EMPTY);

    String filtering =
        URLEncoder.encode(
            "[{\"field\":\"ad.id\",\"operator\":\"IN\",\"value\":[\"" + adIds.get(0) + "\",\"" + adIds.get(1) + "\"]}]",
            StandardCharsets.UTF_8);

    JsonNode data =
        graph.get(
            "/" + campaignId + "/insights"
                + "?level=ad"
                + "&fields=ad_id,impressions,clicks,ctr,spend"
                + "&filtering=" + filtering
                + "&date_preset=maximum"
                + "&access_token=" + token);

    return List.of(row(data.get("data"), adIds.get(0)), row(data.get("data"), adIds.get(1)));
  }

  static AdKpi row(JsonNode rows, String adId) {
    JsonNode found = null;
    if (rows != null && rows.isArray()) {
      for (JsonNode r : rows) {
        if (adId.equals(r.path("ad_id").asString(null))) {
          found = r;
          break;
        }
      }
    }
    if (found == null) return AdKpi.EMPTY;
    return new AdKpi(
        (int) Math.round(num(found, "impressions")),
        (int) Math.round(num(found, "clicks")),
        Math.round(num(found, "ctr") * 100) / 100.0,
        Math.round(num(found, "spend")));
  }

  /* ─── 파싱 헬퍼 ─────────────────────────────────────────────── */

  /** results 는 배열로 올 때도 있고 {data: […]} 로 감싸 올 때도 있다. */
  private static List<JsonNode> entryArray(JsonNode r) {
    List<JsonNode> out = new ArrayList<>();
    if (r == null || r.isNull()) return out;
    JsonNode arr = r.isArray() ? r : r.get("data");
    if (arr != null && arr.isArray()) for (JsonNode e : arr) out.add(e);
    return out;
  }

  /** 셀 이름을 A/B 로 정규화 — 'A' · 'Cell A' · '챌린저' 등 흔한 표기를 흡수. 실패하면 null. */
  private static String normalizeCell(String name) {
    String s = (name == null ? "" : name).toUpperCase();
    if (CELL_A.matcher(s).find()) return "A";
    if (CELL_B.matcher(s).find()) return "B";
    return null;
  }

  private static boolean significant(JsonNode e) {
    return e.path("winner").asBoolean(false)
        || e.path("is_winner").asBoolean(false)
        || e.path("is_significant").asBoolean(false)
        || e.path("significant").asBoolean(false);
  }

  /** confidence 우선, 없으면 p_value 의 여집합, 그것도 없으면 유의 여부로 0.95/0.5. 퍼센트(>1)는 100으로 나눈다. */
  private static double confidence(JsonNode e, boolean significant) {
    Double conf = numberOrNull(e.get("confidence"));
    if (conf != null) return clamp(conf > 1 ? conf / 100 : conf);
    Double p = numberOrNull(e.get("p_value"));
    if (p != null) return clamp(1 - (p > 1 ? p / 100 : p));
    return significant ? 0.95 : 0.5;
  }

  private static double clamp(double v) {
    return Math.min(Math.max(v, 0), 1);
  }

  private static Double numberOrNull(JsonNode n) {
    if (n == null || n.isNull()) return null;
    double v = n.isNumber() ? n.asDouble() : parse(n.asString(null));
    return Double.isFinite(v) ? v : null;
  }

  private static double parse(String s) {
    if (s == null || s.isBlank()) return Double.NaN;
    try {
      return Double.parseDouble(s);
    } catch (NumberFormatException e) {
      return Double.NaN;
    }
  }

  private static String firstText(JsonNode e, String... keys) {
    for (String k : keys) {
      JsonNode n = e.get(k);
      if (n != null && !n.isNull()) return n.asString();
    }
    return null;
  }

  private static double num(JsonNode r, String key) {
    JsonNode n = r.get(key);
    if (n == null || n.isNull()) return 0;
    double v = n.isNumber() ? n.asDouble() : parse(n.asString(null));
    return Double.isFinite(v) ? v : 0;
  }
}
