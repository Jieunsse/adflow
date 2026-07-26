package ai.adflow.api.tournament.engine;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 레버 taxonomy (ADR-044). TS: lever.ts.
 *
 * <p>레버는 가설이 건드리는 변형 차원의 구조화 키다. 자유 서술을 금지해야 Ledger 집계와 중복 회피가
 * 가능하다.
 *
 * <p>목록·라벨·추천 훅 표가 TS 와 <b>양쪽에 산다.</b> 드리프트를 사람이 지키지 않게 골든 픽스처가
 * 목록 전체와 목표별 풀 순서까지 박아 검증한다.
 */
public final class Levers {

  private Levers() {}

  public static final List<String> COPY =
      List.of("benefit", "trust", "number", "rush", "unique", "trendy", "surprise", "story");

  public static final List<String> NON_COPY =
      List.of("audience-framing", "value-prop", "proof", "image-scene", "format");

  public static final List<String> ALL = concat(COPY, NON_COPY);

  private static final Set<String> COPY_SET = Set.copyOf(COPY);

  private static final Map<String, String> LABELS = labels();

  /** 레버가 헤드라인 슬롯을 바꾸는지 — 아니면 카피 슬롯. TS 의 HEADLINE_LEVERS 와 같아야 한다. */
  private static final Set<String> HEADLINE =
      Set.of("benefit", "number", "surprise", "trendy", "unique", "value-prop", "audience-framing");

  /** 데모 반증 연출 — 이 레버는 챔피언이 유의 방어한다(ADR-044 PRD §2.1.6). */
  private static final Set<String> DEMO_REFUTING = Set.of("rush", "surprise");

  /** 데모 입증 연출 — 강한 lift. */
  private static final Set<String> DEMO_STRONG = Set.of("trust", "number", "proof", "benefit");

  /**
   * 목표별 추천 3훅. TS: options.ts 의 HOOK_RECOMMENDATIONS_BY_OBJECTIVE 를 토너먼트가 쓰는 4개
   * 목표만 추린 것이다(TOUR_OBJECTIVE_OPTIONS 밖의 목표는 셋업에서 고를 수 없다).
   */
  private static final Map<String, List<String>> RECOMMENDED =
      Map.of(
          "traffic", List.of("number", "trust", "benefit"),
          "awareness", List.of("surprise", "story", "unique"),
          "engagement", List.of("trendy", "story", "surprise"),
          "leads_call", List.of("trust", "number", "benefit"));

  /** 알 수 없는 목표의 폴백. TS 의 try/catch 폴백과 같은 값. */
  private static final List<String> RECOMMENDED_FALLBACK = List.of("number", "trust", "benefit");

  public static boolean isCopy(String lever) {
    return COPY_SET.contains(lever);
  }

  public static String label(String lever) {
    String l = LABELS.get(lever);
    if (l == null) throw new IllegalArgumentException("알 수 없는 레버예요: " + lever);
    return l;
  }

  public static boolean swapsHeadline(String lever) {
    return HEADLINE.contains(lever);
  }

  public static boolean isDemoRefuting(String lever) {
    return DEMO_REFUTING.contains(lever);
  }

  public static boolean isDemoStrong(String lever) {
    return DEMO_STRONG.contains(lever);
  }

  /**
   * 후보 레버 풀 — 목표 추천 훅을 앞에, 나머지 카피 + 비카피 순.
   *
   * <p>image-scene 은 자동 순회에서 제외한다(PRD §8 후속).
   */
  public static List<String> pool(String objective) {
    List<String> recommended = RECOMMENDED.getOrDefault(objective, RECOMMENDED_FALLBACK);
    List<String> out = new ArrayList<>(recommended);
    for (String l : COPY) if (!recommended.contains(l)) out.add(l);
    for (String l : NON_COPY) if (!"image-scene".equals(l)) out.add(l);
    return out;
  }

  private static List<String> concat(List<String> a, List<String> b) {
    List<String> out = new ArrayList<>(a);
    out.addAll(b);
    return List.copyOf(out);
  }

  private static Map<String, String> labels() {
    Map<String, String> m = new LinkedHashMap<>();
    // 카피 8종 — TS 의 COPY_HOOK_MAP[l].ko.
    m.put("benefit", "혜택");
    m.put("trust", "신뢰");
    m.put("number", "수치");
    m.put("rush", "긴급");
    m.put("unique", "차별화");
    m.put("trendy", "트렌드");
    m.put("surprise", "반전");
    m.put("story", "스토리");
    // 비카피 5종 — TS 의 NON_COPY_LABEL.
    m.put("audience-framing", "타깃 호명");
    m.put("value-prop", "핵심 제안");
    m.put("proof", "근거 제시");
    m.put("image-scene", "이미지 연출");
    m.put("format", "구성·길이");
    return Map.copyOf(m);
  }

  /** 레버별 가설 문장·근거 골자. {metric} 은 목표 지표명으로 치환된다. TS: LEVER_HYPOTHESIS. */
  public record Template(String claim, String rationale) {}

  private static final Map<String, Template> TEMPLATES = templates();

  public static Template template(String lever) {
    Template t = TEMPLATES.get(lever);
    if (t == null) throw new IllegalArgumentException("알 수 없는 레버예요: " + lever);
    return t;
  }

  private static Map<String, Template> templates() {
    Map<String, Template> m = new LinkedHashMap<>();
    m.put("benefit", new Template("혜택을 먼저 말하면 {metric}이 오른다", "이 브랜드 고객은 '효과'를 먼저 확인하려는 경향이 강해요."));
    m.put("trust", new Template("근거·후기로 신뢰를 주면 {metric}이 오른다", "민감 카테고리라 신뢰 신호가 클릭을 좌우해요."));
    m.put("number", new Template("구체적 수치로 설득하면 {metric}이 오른다", "Proof Point 의 재구매율·성분 수치를 카피에 쓸 수 있어요."));
    m.put("rush", new Template("긴박감을 주면 {metric}이 오른다", "한정·시즌 맥락에서 즉시 행동 유인이 통할 수 있어요."));
    m.put("unique", new Template("차별점을 분명히 하면 {metric}이 오른다", "경쟁 제품과 겹치는 메시지에서 벗어나면 주목도가 올라가요."));
    m.put("trendy", new Template("요즘 흐름에 얹으면 {metric}이 오른다", "타깃 연령대가 트렌드 키워드에 민감해요."));
    m.put("surprise", new Template("예상을 뒤집는 훅이 {metric}을 올린다", "스크롤을 멈추게 하는 반전이 노출 대비 클릭을 끌어올려요."));
    m.put("story", new Template("이야기로 몰입시키면 {metric}이 오른다", "브랜드 보이스가 서사형이라 스토리 훅과 잘 맞아요."));
    m.put("audience-framing", new Template("세그먼트를 직접 호명하면 {metric}이 오른다", "페르소나를 콕 집으면 '내 얘기' 반응이 나와요."));
    m.put("value-prop", new Template("핵심 제안 자체를 바꾸면 {metric}이 오른다", "표현보다 제안이 약할 때 제안을 손볼 여지가 있어요."));
    m.put("proof", new Template("Proof Point 를 전면에 쓰면 {metric}이 오른다", "보유한 근거 자료를 카피에 직접 노출해 신뢰를 높여요."));
    m.put("image-scene", new Template("이미지 연출을 바꾸면 {metric}이 오른다", "씬·구도가 시선을 먼저 잡아 클릭에 영향을 줘요."));
    m.put("format", new Template("길이·구조를 바꾸면 {metric}이 오른다", "짧게/리스트형이 모바일 가독성에서 유리할 수 있어요."));
    return Map.copyOf(m);
  }
}
