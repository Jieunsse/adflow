// ADR-043 — Notion Connection 영속. server-side only.
//
// 단계 7 에서 Supabase 에서 Spring 으로 넘어왔다. 액세스 토큰은 이제 암호화 컬럼에 앉는다.
// user_key = NextAuth sub/email (라우트에서 getToken 으로 해석해 넘긴다).
//
// Notion OAuth 콜백은 Spring JWT 를 들고 오지 않아서 내부 시크릿 경로를 쓴다.

import { backendBaseUrl, internalSecret } from "@shared/lib/backend/client";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDataDir } from "@/lib/meta-credentials";

const PATH = "/internal/notion-connections";
const workspaceOwnerFile = () => path.join(getDataDir(), "workspace-notion-owner.txt");
const workspaceAuditFile = () => path.join(getDataDir(), "workspace-notion-audit.json");

export type WorkspaceNotionAudit = { actor: string; action: "set" | "clear"; timestamp: string };

export async function getWorkspaceNotionAudit(): Promise<WorkspaceNotionAudit[]> {
  try {
    return JSON.parse(await fs.readFile(workspaceAuditFile(), "utf8")) as WorkspaceNotionAudit[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function appendWorkspaceNotionAudit(actor: string, action: WorkspaceNotionAudit["action"]): Promise<void> {
  await fs.mkdir(getDataDir(), { recursive: true });
  const audit = await getWorkspaceNotionAudit();
  audit.push({ actor, action, timestamp: new Date().toISOString() });
  await fs.writeFile(workspaceAuditFile(), JSON.stringify(audit, null, 2), { mode: 0o600 });
}

export async function getWorkspaceNotionOwner(): Promise<string | null> {
  try {
    return (await fs.readFile(workspaceOwnerFile(), "utf8")).trim() || null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function setWorkspaceNotionOwner(ownerKey: string, actor: string): Promise<void> {
  await fs.mkdir(getDataDir(), { recursive: true });
  await fs.writeFile(workspaceOwnerFile(), ownerKey, { mode: 0o600 });
  await appendWorkspaceNotionAudit(actor, "set");
}

export async function clearWorkspaceNotionOwner(actor: string): Promise<void> {
  try {
    await fs.unlink(workspaceOwnerFile());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await appendWorkspaceNotionAudit(actor, "clear");
}

export type NotionConnection = {
  accessToken: string;
  botId?: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceIcon?: string;
};

function endpoint(userKey: string): { url: string; secret: string } | null {
  const base = backendBaseUrl();
  const secret = internalSecret();
  if (!base || !secret) return null; // 백엔드 미설정이면 조용히 휴면 (둘러보기 배포와 같은 계약)
  return { url: `${base}${PATH}?userKey=${encodeURIComponent(userKey)}`, secret };
}

export async function getNotionConnection(userKey: string): Promise<NotionConnection | null> {
  const e = endpoint(userKey);
  if (!e) return null;

  const res = await fetch(e.url, { headers: { "X-Internal-Secret": e.secret } });
  if (res.status === 204 || !res.ok) return null; // 204 = 연결 없음
  return (await res.json()) as NotionConnection;
}

export async function saveNotionConnection(userKey: string, conn: NotionConnection): Promise<void> {
  const e = endpoint(userKey);
  if (!e) return;

  const res = await fetch(e.url, {
    method: "POST",
    headers: { "X-Internal-Secret": e.secret, "Content-Type": "application/json" },
    body: JSON.stringify(conn),
  });
  if (!res.ok) console.error("[notion-store] saveNotionConnection 실패", res.status, await res.text());
}

export async function deleteNotionConnection(userKey: string): Promise<void> {
  const e = endpoint(userKey);
  if (!e) return;

  const res = await fetch(e.url, { method: "DELETE", headers: { "X-Internal-Secret": e.secret } });
  if (!res.ok) console.error("[notion-store] deleteNotionConnection 실패", res.status, await res.text());
}
