// Server-side only — Notion 자원 탐색·텍스트 추출 (ADR-043).
// API 2025-09-03: 검색 단위 = page · data_source. rate limit ~3 req/sec 고려해 캡을 둔다.
import { Client } from "@notionhq/client";

export type NotionResourceType = "page" | "data_source";

export interface NotionResource {
  id: string;
  title: string;
  type: NotionResourceType;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function richText(arr: ReadonlyArray<{ plain_text?: string }> | undefined): string {
  return (arr ?? []).map((r) => r.plain_text ?? "").join("");
}

function pageTitle(page: AnyObj): string {
  const props = (page.properties ?? {}) as AnyObj;
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.type === "title") return richText(p.title);
  }
  return "";
}

// 공유된 page·data_source 목록. import 자원 선택 모달에서 쓴다.
export async function searchSharedResources(accessToken: string): Promise<NotionResource[]> {
  const notion = new Client({ auth: accessToken });
  const out: NotionResource[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const res = await notion.search({ start_cursor: cursor, page_size: 50 });
    for (const r of res.results as AnyObj[]) {
      if (r.object === "page" && "properties" in r) {
        out.push({ id: r.id, title: pageTitle(r) || "제목 없음", type: "page" });
      } else if (r.object === "data_source" && "title" in r) {
        out.push({ id: r.id, title: richText(r.title) || "제목 없는 데이터베이스", type: "data_source" });
      }
    }
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}

function blockText(block: AnyObj): string {
  const data = block[block.type];
  if (data && Array.isArray(data.rich_text)) return richText(data.rich_text);
  return "";
}

// 페이지 블록 재귀. child_page·child_database 는 미추적(ADR-043 추출 깊이 결정).
async function fetchPageText(notion: Client, blockId: string, depth = 0): Promise<string> {
  if (depth > 3) return "";
  const lines: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 });
    for (const block of res.results as AnyObj[]) {
      if (!("type" in block)) continue;
      if (block.type === "child_page" || block.type === "child_database") continue;
      const text = blockText(block);
      if (text) lines.push(text);
      if (block.has_children) {
        const nested = await fetchPageText(notion, block.id, depth + 1);
        if (nested) lines.push(nested);
      }
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return lines.join("\n");
}

function propText(p: AnyObj): string {
  switch (p?.type) {
    case "title": return richText(p.title);
    case "rich_text": return richText(p.rich_text);
    case "select": return p.select?.name ?? "";
    case "multi_select": return (p.multi_select ?? []).map((s: AnyObj) => s.name).join(", ");
    case "number": return p.number != null ? String(p.number) : "";
    case "url": return p.url ?? "";
    default: return "";
  }
}

// data_source 의 row 속성 텍스트만(ADR-043). row 200개 캡.
async function fetchDataSourceText(notion: Client, dataSourceId: string): Promise<string> {
  const lines: string[] = [];
  let cursor: string | undefined;
  let count = 0;
  do {
    const res = await notion.dataSources.query({ data_source_id: dataSourceId, start_cursor: cursor, page_size: 100 });
    for (const row of res.results as AnyObj[]) {
      if (!("properties" in row)) continue;
      const parts: string[] = [];
      for (const key of Object.keys(row.properties)) {
        const v = propText(row.properties[key]);
        if (v) parts.push(v);
      }
      if (parts.length) lines.push(parts.join(" · "));
      if (++count >= 200) return lines.join("\n");
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return lines.join("\n");
}

export async function fetchResourceText(accessToken: string, resource: NotionResource): Promise<string> {
  const notion = new Client({ auth: accessToken });
  const body = resource.type === "page"
    ? await fetchPageText(notion, resource.id)
    : await fetchDataSourceText(notion, resource.id);
  return `## ${resource.title}\n${body}`.trim();
}
