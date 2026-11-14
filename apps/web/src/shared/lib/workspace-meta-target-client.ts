import { getActiveId } from "@features/brand-profile/model/brandProfileStore";
import {
  ACTIVE_BRAND_EVENT,
  fetchBrandConnection,
  saveBrandConnection,
} from "@features/brand-profile/model/brandConnection";

/**
 * 연결 관리 화면에서 고른 광고 계정·페이지·픽셀을 지금 브랜드의 연결로 저장한다 (기능 10). 저장한 뒤 세션도 그
 * 값으로 맞추도록 BrandConnectionSync 에 알린다 — Meta 를 부르는 라우트들이 세션 값을 읽는다.
 */
export async function saveWorkspaceTarget(patch: Record<string, string>) {
  const brandId = getActiveId();
  if (!brandId) throw new Error("브랜드를 먼저 골라 주세요.");
  const current = (await fetchBrandConnection(brandId)) ?? {};
  const next = { ...current, ...patch };
  const failed = await saveBrandConnection(brandId, next);
  if (failed) throw new Error(failed);
  window.dispatchEvent(new Event(ACTIVE_BRAND_EVENT));
  return next as Record<string, string>;
}
