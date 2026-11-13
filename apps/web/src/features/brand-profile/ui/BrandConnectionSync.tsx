"use client";

// 지금 고른 브랜드의 광고 계정을 세션에 맞춘다 (기능 10). 연결이 없는 브랜드면 세션의 계정을 비워
// /setup 으로 보낸다 — 이전 브랜드의 광고 계정으로 다른 고객 광고가 나가지 않게.
// 예외: 브랜드가 하나뿐이면 세션의 계정이 곧 그 브랜드 것이다(첫 온보딩, 브랜드 연결 전 사용자). 그대로 저장한다.

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useBrandProfileStorage } from "../model/useBrandProfileStorage";
import { getActiveId } from "../model/brandProfileStore";
import {
  ACTIVE_BRAND_EVENT,
  fetchBrandConnection,
  saveBrandConnection,
} from "../model/brandConnection";

export default function BrandConnectionSync() {
  const { data: session, update } = useSession();
  const { profiles } = useBrandProfileStorage();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(ACTIVE_BRAND_EVENT, bump);
    return () => window.removeEventListener(ACTIVE_BRAND_EVENT, bump);
  }, []);

  const stored = getActiveId();
  const brandId =
    profiles.find((p) => p.id === stored)?.id ??
    profiles.find((p) => p.isDefault)?.id ??
    profiles[0]?.id;
  const adAccountId = session?.adAccountId ?? "";
  const pageId = session?.pageId ?? "";
  const onlyBrand = profiles.length === 1;
  const skip = !session || session.browseMode || !brandId;

  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    void fetchBrandConnection(brandId).then((c) => {
      if (cancelled || !c) return;
      if (!c.adAccountId && onlyBrand && adAccountId && pageId) {
        void saveBrandConnection(brandId, {
          adAccountId,
          adAccountName: session?.adAccountName,
          pageId,
          pageName: session?.pageName,
          pixelId: session?.pixelId,
          pixelName: session?.pixelName,
          igUserId: session?.igUserId,
          igUsername: session?.igUsername,
        });
        return;
      }
      if ((c.adAccountId ?? "") === adAccountId && (c.pageId ?? "") === pageId) return;
      void update({
        adAccountId: c.adAccountId ?? "",
        adAccountName: c.adAccountName ?? "",
        pageId: c.pageId ?? "",
        pageName: c.pageName ?? "",
        pixelId: c.pixelId ?? "",
        pixelName: c.pixelName ?? "",
        igUserId: c.igUserId ?? "",
        igUsername: c.igUsername ?? "",
      }).then(() => {
        // 연결이 없어 세션을 비웠다. 서버 가드(proxy.ts)가 /setup 으로 보내도록 다시 연다.
        if (!c.adAccountId) window.location.reload();
      });
    });
    return () => {
      cancelled = true;
    };
    // session 객체 전체를 넣으면 update 때마다 다시 돈다. 비교에 쓰는 값만 넣는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, brandId, onlyBrand, adAccountId, pageId, tick, update]);

  return null;
}
