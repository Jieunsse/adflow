// 공유 상태 store 팩토리 배럴(ADR-046). 서버 라우트는 client-only 모듈 누수를 피해
// ownerKey 를 직접 import 한다 (`@shared/lib/store/ownerKey`).
export { createSyncedStore } from "./createSyncedStore";
export type {
  SyncedItem,
  SyncedState,
  SyncStatus,
  SyncedStore,
  SyncedStoreConfig,
} from "./createSyncedStore";
export { GUEST_OWNER, isRealOwner } from "./ownerKey";
