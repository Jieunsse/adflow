import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { metaAds } from "@/lib/meta-ads";
import { resolveAccessToken, resolveAdAccountId } from "@/lib/env";

// POST /api/campaign/relaunch
// 안전 검사 4종 통과 후 원본 캠페인을 같은 내용으로 새로 생성 (PRD-auto-relaunch §6).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || !session?.adAccountId || !session?.pageId) {
    return NextResponse.json({ error: "Meta 계정 연결이 필요해요." }, { status: 401 });
  }

  const body = (await req.json()) as { campaignId?: string; cycleCount?: number };
  const { campaignId, cycleCount = 2 } = body;
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId가 필요해요." }, { status: 400 });
  }

  const token = resolveAccessToken(session.accessToken);
  const adAccountId = resolveAdAccountId(session.adAccountId);
  const pageId = session.pageId;

  // Safety check 1: Meta 계정 상태
  let accountStatus;
  try {
    accountStatus = await metaAds.checkAccount(token, adAccountId);
  } catch {
    return NextResponse.json({ error: "광고 계정 상태를 확인할 수 없어요." }, { status: 502 });
  }
  if (!accountStatus.connected) {
    return NextResponse.json({
      error: "광고 계정이 활성 상태가 아니에요.",
      errorCode: "account_inactive",
    }, { status: 400 });
  }

  // Safety check 2 & 3 & 4: 원본 캠페인 정보 조회 (잔액·타겟·토큰은 account check 로 겸함)
  let original;
  try {
    original = await metaAds.getCampaign(campaignId, token);
  } catch {
    return NextResponse.json({ error: "원본 캠페인 정보를 불러오지 못했어요." }, { status: 502 });
  }

  if (!original) {
    return NextResponse.json({ error: "원본 캠페인을 찾을 수 없어요." }, { status: 404 });
  }

  // 재게재에 필요한 필드 확인
  const hasMissingFields = !original.headline || !original.primaryText || !original.countries?.length;
  if (hasMissingFields) {
    return NextResponse.json({ error: "원본 캠페인 정보가 부족해 재게재할 수 없어요." }, { status: 400 });
  }

  // 이미지 fetch (imageUrl 있으면 base64 변환, 없으면 image 없이 진행)
  let imageDataUrl: string | undefined;
  if (original.imageUrl) {
    try {
      const imgRes = await fetch(original.imageUrl);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const base64 = Buffer.from(buffer).toString("base64");
        imageDataUrl = `data:${contentType};base64,${base64}`;
      }
    } catch {
      // 이미지 없이 계속 진행 (Meta API 가 거부할 수 있음)
    }
  }

  // 새 캠페인 이름: "{원본 이름} (자동 재게재 #N)"
  const originalName = original.name;
  const baseName = originalName.replace(/ \(자동 재게재 #\d+\)$/, "");
  const newName = `${baseName} (자동 재게재 #${cycleCount})`;

  try {
    const result = await metaAds.createCampaign(
      {
        headline: original.headline ?? "",
        primaryText: original.primaryText ?? "",
        dailyBudget: original.dailyBudget ?? 50000,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: original.endDate ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        ageMin: original.ageMin ?? 18,
        ageMax: original.ageMax ?? 65,
        genders: original.genders ?? [],
        countries: original.countries ?? ["KR"],
        linkUrl: original.landingUrl ?? "",
        ctaType: original.cta ?? "LEARN_MORE",
        status: "ACTIVE",
        imageDataUrl,
        objective: (original.objective as "OUTCOME_TRAFFIC" | "OUTCOME_AWARENESS" | "OUTCOME_ENGAGEMENT" | "OUTCOME_LEADS") ?? "OUTCOME_TRAFFIC",
        bidStrategy: original.bidStrategy,
        bidAmount: original.bidAmount ?? undefined,
        platforms: original.platforms,
        placements: original.placementMode === "manual" && original.placementPositions?.length
          ? { mode: "manual", positions: original.placementPositions }
          : { mode: "auto" },
      },
      token,
      adAccountId,
      pageId,
    );

    // name 은 createCampaign 에서 설정되는데, 현재 params 에 name 필드가 없음 → 생성 후 rename.
    // MVP: name suffix 는 Meta 에 직접 PATCH 로 설정.
    try {
      const graphBase = "https://graph.facebook.com/v20.0";
      await fetch(`${graphBase}/${result.campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, access_token: token }),
      });
    } catch {
      // 이름 변경 실패는 무시 (새 캠페인 자체는 성공)
    }

    return NextResponse.json({
      campaignId: result.campaignId,
      adSetId: result.adSetId,
      adId: result.adId,
      adIds: result.adIds,
      newName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "재게재에 실패했어요";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
