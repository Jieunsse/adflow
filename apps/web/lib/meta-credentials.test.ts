import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { tmpdir } from "node:os"
import { mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import {
  __test,
  clearMetaCredentials,
  getMetaCredentials,
  getMetaCredentialsAuditLog,
  setMetaCredentials,
} from "./meta-credentials"

const { encrypt, decrypt } = __test

let tmpDir: string

beforeEach(async () => {
  process.env.NEXTAUTH_SECRET = "test-secret-stable-across-cases"
  tmpDir = await mkdtemp(path.join(tmpdir(), "adflow-cred-"))
  process.env.ADFLOW_DATA_DIR = tmpDir
  delete process.env.META_CLIENT_ID
  delete process.env.META_CLIENT_SECRET
})

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
})

describe("AES-256-GCM round-trip", () => {
  it("encrypt → decrypt 가 원본을 복원해요", () => {
    const original = JSON.stringify({ clientId: "1234567890", clientSecret: "abcdef1234567890" })
    const encoded = encrypt(original)
    expect(encoded).not.toBe(original)
    expect(decrypt(encoded)).toBe(original)
  })

  it("같은 평문도 매번 다른 ciphertext 를 만들어요 (IV randomization)", () => {
    const a = encrypt("same-plaintext")
    const b = encrypt("same-plaintext")
    expect(a).not.toBe(b)
  })

  it("다른 NEXTAUTH_SECRET 으로 복호화 시도 시 실패해요", () => {
    const encoded = encrypt("payload")
    process.env.NEXTAUTH_SECRET = "different-secret"
    expect(() => decrypt(encoded)).toThrow()
  })
})

describe("getMetaCredentials / setMetaCredentials", () => {
  it("저장된 자격증명이 없으면 null", async () => {
    expect(await getMetaCredentials()).toBeNull()
  })

  it("저장 후 조회하면 원본 자격증명이 돌아와요", async () => {
    await setMetaCredentials({ clientId: "111", clientSecret: "222" }, "alice@test")
    expect(await getMetaCredentials()).toEqual({ clientId: "111", clientSecret: "222" })
  })

  it("파일 저장이 env 폴백보다 우선", async () => {
    process.env.META_CLIENT_ID = "env-id"
    process.env.META_CLIENT_SECRET = "env-secret"
    await setMetaCredentials({ clientId: "file-id", clientSecret: "file-secret" }, "actor")
    expect(await getMetaCredentials()).toEqual({ clientId: "file-id", clientSecret: "file-secret" })
  })

  it("파일이 없으면 env 폴백", async () => {
    process.env.META_CLIENT_ID = "env-id"
    process.env.META_CLIENT_SECRET = "env-secret"
    expect(await getMetaCredentials()).toEqual({ clientId: "env-id", clientSecret: "env-secret" })
  })
})

describe("audit log", () => {
  it("set/clear 모두 audit 에 기록", async () => {
    await setMetaCredentials({ clientId: "111", clientSecret: "222" }, "alice")
    await clearMetaCredentials("bob")
    const log = await getMetaCredentialsAuditLog()
    expect(log).toHaveLength(2)
    expect(log[0]).toMatchObject({ actor: "alice", action: "set" })
    expect(log[1]).toMatchObject({ actor: "bob", action: "clear" })
    expect(typeof log[0].timestamp).toBe("string")
  })
})
