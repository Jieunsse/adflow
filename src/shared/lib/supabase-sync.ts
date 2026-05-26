import { supabase } from "./supabase";

// localStorage가 primary. 이 헬퍼는 백그라운드 미러링 전용 — 실패 시 무시.
export function syncUpsert(table: string, row: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  Promise.resolve(supabase.from(table).upsert(row)).then(
    () => {},
    () => {},
  );
}

export function syncDelete(table: string, column: string, value: string): void {
  if (typeof window === "undefined") return;
  Promise.resolve(supabase.from(table).delete().eq(column, value)).then(
    () => {},
    () => {},
  );
}
