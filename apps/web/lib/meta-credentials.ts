// Server-side only — do not import from client components; encryption key & secrets would leak.
// Meta 앱 자격증명(client_id, client_secret) 저장소.
//
// 로컬 암호화 파일 (`.adflow/meta-credentials.enc`) + .env.local 폴백.
// CredentialStore 인터페이스를 유지해서 추후 원격 저장소 어댑터로 갈아끼우기 쉽게 설계.

import { promises as fs } from "node:fs"
import path from "node:path"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

export interface MetaCredentials {
  clientId: string
  clientSecret: string
}

export interface AuditEntry {
  actor: string
  action: "set" | "clear"
  timestamp: string // ISO 8601
}

interface CredentialStore {
  get(): Promise<MetaCredentials | null>
  set(creds: MetaCredentials, actor: string): Promise<void>
  clear(actor: string): Promise<void>
  getAuditLog(): Promise<AuditEntry[]>
}

// ── AES-256-GCM helpers ────────────────────────────────────────────────────

// NEXTAUTH_SECRET 을 sha256 으로 정규화해서 32바이트 키로 사용.
function getMasterKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET이 비어있어요. 마법사 셋업 전에 .env.local을 확인해주세요.")
  }
  return createHash("sha256").update(secret).digest()
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getMasterKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

export function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, "base64")
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || buf.toString("base64") !== encoded) {
    throw new Error("암호화 payload 형식이 올바르지 않아요.")
  }
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", getMasterKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
}

// ── 로컬 파일 어댑터 ───────────────────────────────────────────────────────

export function getDataDir(): string {
  return process.env.ADFLOW_DATA_DIR ?? path.join(process.cwd(), ".adflow")
}
function credFile(): string {
  return path.join(getDataDir(), "meta-credentials.enc")
}
function auditFile(): string {
  return path.join(getDataDir(), "meta-credentials-audit.json")
}

async function appendAudit(entry: AuditEntry): Promise<void> {
  await fs.mkdir(getDataDir(), { recursive: true })
  let log: AuditEntry[] = []
  try {
    const data = await fs.readFile(auditFile(), "utf8")
    log = JSON.parse(data) as AuditEntry[]
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }
  log.push(entry)
  await fs.writeFile(auditFile(), JSON.stringify(log, null, 2), { mode: 0o600 })
}

const localFileStore: CredentialStore = {
  async get() {
    try {
      const data = await fs.readFile(credFile(), "utf8")
      return JSON.parse(decrypt(data.trim())) as MetaCredentials
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
      throw err
    }
  },
  async set(creds, actor) {
    await fs.mkdir(getDataDir(), { recursive: true })
    await fs.writeFile(credFile(), encrypt(JSON.stringify(creds)), { mode: 0o600 })
    await appendAudit({ actor, action: "set", timestamp: new Date().toISOString() })
  },
  async clear(actor) {
    try {
      await fs.unlink(credFile())
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    }
    await appendAudit({ actor, action: "clear", timestamp: new Date().toISOString() })
  },
  async getAuditLog() {
    try {
      const data = await fs.readFile(auditFile(), "utf8")
      return JSON.parse(data) as AuditEntry[]
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
      throw err
    }
  },
}

// ── Public API ─────────────────────────────────────────────────────────────

// 우선순위: 로컬 파일 → .env.local 폴백. 마법사로 저장한 값이 항상 우선.
export async function getMetaCredentials(): Promise<MetaCredentials | null> {
  const fromFile = await localFileStore.get()
  if (fromFile) return fromFile
  const id = process.env.META_CLIENT_ID
  const secret = process.env.META_CLIENT_SECRET
  if (!id || !secret) return null
  return { clientId: id, clientSecret: secret }
}

export async function setMetaCredentials(creds: MetaCredentials, actor: string): Promise<void> {
  await localFileStore.set(creds, actor)
  credentialsCache.invalidate()
}

export async function clearMetaCredentials(actor: string): Promise<void> {
  await localFileStore.clear(actor)
  credentialsCache.invalidate()
}

export async function getMetaCredentialsAuditLog(): Promise<AuditEntry[]> {
  return localFileStore.getAuditLog()
}

// ── 5분 in-process 캐시 — NextAuth 동적 옵션 핸들러용 ────────────────────────
// 매 요청마다 파일 IO 안 하도록. set/clear 시 자동 invalidate.

const CACHE_TTL_MS = 5 * 60 * 1000
let cached: { value: MetaCredentials | null; expiresAt: number } | null = null

export const credentialsCache = {
  async get(): Promise<MetaCredentials | null> {
    const now = Date.now()
    if (cached && cached.expiresAt > now) return cached.value
    const value = await getMetaCredentials()
    cached = { value, expiresAt: now + CACHE_TTL_MS }
    return value
  },
  invalidate(): void {
    cached = null
  },
}

// Test seam — round-trip 검증용 export.
export const __test = { encrypt, decrypt }
