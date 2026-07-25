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
    mediaUrl: "/demo/library/cream.jpg",
    caption: "비건 수분 크림 2주 써봤어요. 무향이라 순하고 진짜 촉촉해요 ✨ @greenroutine_official #ad",
    timestamp: "2026-05-20T09:00:00Z",
    isEligibleForBrandedContent: true,
  },
  {
    id: "bc2",
    creatorUsername: "minimal.daily",
    creatorAvatarUrl: "https://i.pravatar.cc/64?img=15",
    mediaUrl: "/demo/library/toner.jpg",
    caption: "아침 루틴에 자연스럽게 녹아드는 비건 토너. 협찬받았지만 진심 추천 @greenroutine_official",
    timestamp: "2026-05-18T14:30:00Z",
    isEligibleForBrandedContent: true,
  },
  {
    id: "bc3",
    creatorUsername: "kim.review",
    creatorAvatarUrl: "https://i.pravatar.cc/64?img=33",
    mediaUrl: "/demo/library/serum.jpg",
    caption: "이번 협업 후기 — 식물성 세럼 발림성 좋고 자극도 없어요 @greenroutine_official",
    timestamp: "2026-05-15T11:00:00Z",
    isEligibleForBrandedContent: false,
    ineligibilityReason: "크리에이터가 광고 사용 권한을 아직 승인하지 않았어요",
  },
  {
    id: "bc4",
    creatorUsername: "studio.nara",
    creatorAvatarUrl: "https://i.pravatar.cc/64?img=68",
    mediaUrl: "/demo/library/pack.jpg",
    caption: "환절기 저녁 루틴에 딱 — 오랜만에 마음에 드는 비건 시트 팩 협찬 @greenroutine_official #partnership",
    timestamp: "2026-05-12T16:00:00Z",
    isEligibleForBrandedContent: true,
  },
  {
    id: "bc5",
    creatorUsername: "running.hyo",
    creatorAvatarUrl: "https://i.pravatar.cc/64?img=12",
    mediaUrl: "/demo/library/suncream.png",
    caption: "야외 러닝 전엔 비건 선크림 필수예요 🏃‍♀️ 가볍게 발려요 @greenroutine_official",
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
