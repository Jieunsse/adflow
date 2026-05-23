import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export type BrandedContentItem = {
  id: string
  creatorUsername: string
  creatorAvatarUrl: string
  mediaUrl: string
  caption: string
  timestamp: string
  isEligibleForBrandedContent: boolean
  ineligibilityReason?: string
}

export type BrandedContentResponse = {
  items: BrandedContentItem[]
  mock: boolean
}

const MOCK: BrandedContentItem[] = [
  {
    id: "bc1",
    creatorUsername: "lifestyle.jiwon",
    creatorAvatarUrl: "https://i.pravatar.cc/64?img=47",
    mediaUrl: "https://picsum.photos/seed/bc1/400/400",
    caption: "신상 컬렉션 직접 입어봤어요. 라인이 진짜 예뻐요 ✨ @ourbrand #ad",
    timestamp: "2026-05-20T09:00:00Z",
    isEligibleForBrandedContent: true,
  },
  {
    id: "bc2",
    creatorUsername: "minimal.daily",
    creatorAvatarUrl: "https://i.pravatar.cc/64?img=15",
    mediaUrl: "https://picsum.photos/seed/bc2/400/400",
    caption: "데일리룩에 자연스럽게 녹아드는 색감. 협찬받았지만 진심 추천 @ourbrand",
    timestamp: "2026-05-18T14:30:00Z",
    isEligibleForBrandedContent: true,
  },
  {
    id: "bc3",
    creatorUsername: "kim.review",
    creatorAvatarUrl: "https://i.pravatar.cc/64?img=33",
    mediaUrl: "https://picsum.photos/seed/bc3/400/400",
    caption: "이번 협업 후기 — 제품력 좋고 톤도 마음에 들어요 @ourbrand",
    timestamp: "2026-05-15T11:00:00Z",
    isEligibleForBrandedContent: false,
    ineligibilityReason: "크리에이터가 광고 사용 권한을 아직 승인하지 않았어요",
  },
  {
    id: "bc4",
    creatorUsername: "studio.nara",
    creatorAvatarUrl: "https://i.pravatar.cc/64?img=68",
    mediaUrl: "https://picsum.photos/seed/bc4/400/400",
    caption: "공간에 어울리는 무드 — 오랜만에 마음에 드는 협찬 @ourbrand #partnership",
    timestamp: "2026-05-12T16:00:00Z",
    isEligibleForBrandedContent: true,
  },
  {
    id: "bc5",
    creatorUsername: "running.hyo",
    creatorAvatarUrl: "https://i.pravatar.cc/64?img=12",
    mediaUrl: "https://picsum.photos/seed/bc5/400/400",
    caption: "러닝할 때 가볍고 좋아요 🏃‍♀️ @ourbrand",
    timestamp: "2026-05-08T07:30:00Z",
    isEligibleForBrandedContent: false,
    ineligibilityReason: "게시물이 파트너십 라벨 없이 업로드되어 광고에 사용할 수 없어요",
  },
]

export async function GET(): Promise<NextResponse<BrandedContentResponse>> {
  const session = await getServerSession(authOptions)
  // V1: 실 Graph 호출 미구현. 세션 존재해도 mock 반환. 추후 GET /{ig-user-id}?fields=tagged_media{...,is_eligible_for_branded_content} 로 교체.
  void session
  return NextResponse.json({ items: MOCK, mock: true })
}
