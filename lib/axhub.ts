// Server-side only — do not import from client components; APPHUB_API_KEY would be exposed.

const apiUrl = process.env.APPHUB_API_URL ?? "";
const apiKey = process.env.APPHUB_API_KEY ?? "";
const appSlug = process.env.APPHUB_APP_SLUG ?? "";
const dataBase = process.env.APPHUB_DATA_BASE_URL ?? "";

export type AxhubFetchInit = RequestInit & { revalidate?: number | false };

function buildUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

async function request(url: string, init: AxhubFetchInit): Promise<Response> {
  const { revalidate, headers, ...rest } = init;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (apiKey) finalHeaders.Authorization = `Bearer ${apiKey}`;
  const next = revalidate !== undefined ? { revalidate } : undefined;
  return fetch(url, { ...rest, headers: finalHeaders, ...(next ? { next } : {}) });
}

export async function axhubFetch(path: string, init: AxhubFetchInit = {}): Promise<Response> {
  if (!apiUrl) throw new Error("APPHUB_API_URL 가 설정되지 않았어요. .env.local 또는 axhub deploy 환경을 확인해 주세요.");
  return request(buildUrl(apiUrl, path), init);
}

export async function axhubData(resource: string, init: AxhubFetchInit = {}): Promise<Response> {
  if (!dataBase) throw new Error("APPHUB_DATA_BASE_URL 가 설정되지 않았어요.");
  return request(buildUrl(dataBase, resource), init);
}

export const axhub = {
  fetch: axhubFetch,
  data: axhubData,
  slug: appSlug,
  isConfigured: Boolean(apiUrl && apiKey && appSlug),
};
