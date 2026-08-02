export type IgMediaItem = {
  id: string;
  mediaUrl: string;
  caption: string;
  permalink?: string;
  timestamp: string;
  likeCount: number;
};

export type IgMediaFeed = {
  items: IgMediaItem[];
  mock: boolean;
};

type IgMediaResponse =
  | { ok: true; items: Array<Partial<IgMediaItem> & { id: string }>; mock?: boolean }
  | { ok: false; error?: string };

export const igMediaQueryKey = (limit: number) => ["ig-recent-media", limit] as const;

export async function fetchIgMedia(limit = 5): Promise<IgMediaFeed> {
  const response = await fetch(`/api/instagram/recent-media?limit=${limit}`, { cache: "no-store" });
  const data = (await response.json()) as IgMediaResponse;
  if (!response.ok || !data.ok) {
    throw new Error(!data.ok && data.error ? data.error : "게시물을 불러오지 못했어요");
  }

  return {
    mock: !!data.mock,
    items: data.items.map((item) => ({
      id: item.id,
      mediaUrl: item.mediaUrl ?? "",
      caption: item.caption ?? "",
      ...(item.permalink ? { permalink: item.permalink } : {}),
      timestamp: item.timestamp ?? "",
      likeCount: item.likeCount ?? 0,
    })),
  };
}
