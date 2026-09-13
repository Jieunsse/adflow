// Server-side workspace target. This installation serves one customer workspace;
// user access tokens remain in each user's session and are never stored here.
import { backendBaseUrl, internalSecret } from "@shared/lib/backend/client"

export type WorkspaceMetaTarget = {
  adAccountId?: string
  adAccountName?: string
  pageId?: string
  pageName?: string
  pixelId?: string
  pixelName?: string
  igUserId?: string
  igUsername?: string
}

export type WorkspaceTargetAudit = {
  actor: string
  timestamp: string
  before: WorkspaceMetaTarget
  after: WorkspaceMetaTarget
}

async function call(path: string, init?: { method: string; body?: string }): Promise<Response> {
  const base = backendBaseUrl()
  const secret = internalSecret()
  if (!base || !secret) throw new Error("workspace_meta_target_backend_not_configured")

  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "X-Internal-Secret": secret,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(init?.body ? { body: init.body } : {}),
      cache: "no-store",
    })
  } catch {
    throw new Error("workspace_meta_target_backend_unreachable")
  }
  if (!response.ok) throw new Error(`workspace_meta_target_backend_${response.status}`)
  return response
}

export async function getWorkspaceMetaTarget(): Promise<WorkspaceMetaTarget> {
  const response = await call("/internal/workspace-meta-target")
  const body = await response.json() as { target?: WorkspaceMetaTarget }
  return body.target ?? {}
}

export async function getWorkspaceMetaTargetAudit(): Promise<WorkspaceTargetAudit[]> {
  const response = await call("/internal/workspace-meta-target/audit")
  const body = await response.json() as WorkspaceTargetAudit[]
  return Array.isArray(body) ? body : []
}

export async function updateWorkspaceMetaTarget(
  patch: WorkspaceMetaTarget,
  actor: string,
): Promise<WorkspaceMetaTarget> {
  const query = new URLSearchParams({ actor })
  const response = await call(`/internal/workspace-meta-target?${query}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
  const body = await response.json() as { target?: WorkspaceMetaTarget }
  return body.target ?? {}
}
