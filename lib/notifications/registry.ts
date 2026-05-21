import { AuthError } from "../route-handler";
import { metaAds } from "../meta-ads";
import {
  diffSnapshots,
  snapshotMap,
  type AdEffectiveStatus,
  type AdSnapshot,
} from "./ad-status-diff";
import {
  INITIAL_BACKOFF,
  applyResult,
  nextInterval,
  type ErrorBackoff,
} from "./ad-status-interval";

export interface AdStatusPayload {
  id: string;
  type: "ad-status";
  message: string;
  ts: number;
  adId: string;
  campaignId: string;
  transition: string;
}

export interface AuthExpiredPayload {
  type: "auth_expired";
}

export type NotificationPayload = AdStatusPayload | AuthExpiredPayload;

interface ControllerEntry {
  controller: ReadableStreamDefaultController<Uint8Array>;
  addedAt: number;
}

interface UserEntry {
  controllers: ControllerEntry[];
  lastSnapshot: Map<string, AdEffectiveStatus>;
  timerHandle: ReturnType<typeof setTimeout> | null;
  backoff: ErrorBackoff;
  token: string;
  adAccountId: string;
}

const USER_CONTROLLER_CAP = 10;
const GLOBAL_USER_CAP = 500;

const registry = new Map<string, UserEntry>();
const encoder = new TextEncoder();

function encodePayload(payload: NotificationPayload): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function encodePing(): Uint8Array {
  return encoder.encode(`: ping\n\n`);
}

function safeEnqueue(controller: ReadableStreamDefaultController<Uint8Array>, chunk: Uint8Array): boolean {
  try {
    controller.enqueue(chunk);
    return true;
  } catch {
    return false;
  }
}

function fanOut(entry: UserEntry, payload: NotificationPayload) {
  const chunk = encodePayload(payload);
  entry.controllers = entry.controllers.filter((c) => safeEnqueue(c.controller, chunk));
}

function broadcastPing(entry: UserEntry) {
  const chunk = encodePing();
  entry.controllers = entry.controllers.filter((c) => safeEnqueue(c.controller, chunk));
}

function makeEmissionId(userId: string, adId: string, transition: string, ts: number): string {
  return `${userId}-${adId}-${transition}-${ts}`;
}

function stopWorker(entry: UserEntry) {
  if (entry.timerHandle) {
    clearTimeout(entry.timerHandle);
    entry.timerHandle = null;
  }
}

function scheduleNext(userId: string, entry: UserEntry) {
  const statuses = Array.from(entry.lastSnapshot.values());
  const delay = nextInterval(statuses, entry.backoff);
  entry.timerHandle = setTimeout(() => runTick(userId), delay);
}

async function runTick(userId: string) {
  const entry = registry.get(userId);
  if (!entry || entry.controllers.length === 0) return;

  let ads: AdSnapshot[] | null = null;
  try {
    ads = await metaAds.listAdsForPolling(entry.token, entry.adAccountId);
  } catch (err) {
    if (err instanceof AuthError) {
      fanOut(entry, { type: "auth_expired" });
      stopWorker(entry);
      for (const c of entry.controllers) {
        try { c.controller.close(); } catch {}
      }
      registry.delete(userId);
      return;
    }
    entry.backoff = applyResult(entry.backoff, false);
    scheduleNext(userId, entry);
    return;
  }

  const isBaseline = entry.lastSnapshot.size === 0;
  if (!isBaseline) {
    const emissions = diffSnapshots(entry.lastSnapshot, ads);
    const ts = Date.now();
    for (const e of emissions) {
      fanOut(entry, {
        id: makeEmissionId(userId, e.adId, e.transition, ts),
        type: "ad-status",
        message: e.message,
        ts,
        adId: e.adId,
        campaignId: e.campaignId,
        transition: e.transition,
      });
    }
  }
  entry.lastSnapshot = snapshotMap(ads);
  entry.backoff = applyResult(entry.backoff, true);

  const stillConnected = entry.controllers.length > 0;
  if (stillConnected) scheduleNext(userId, entry);
}

const PING_INTERVAL_MS = 15 * 1000;
const pingHandles = new Map<string, ReturnType<typeof setInterval>>();

function startPing(userId: string) {
  if (pingHandles.has(userId)) return;
  const handle = setInterval(() => {
    const entry = registry.get(userId);
    if (!entry || entry.controllers.length === 0) {
      clearInterval(handle);
      pingHandles.delete(userId);
      return;
    }
    broadcastPing(entry);
  }, PING_INTERVAL_MS);
  pingHandles.set(userId, handle);
}

function stopPing(userId: string) {
  const handle = pingHandles.get(userId);
  if (handle) {
    clearInterval(handle);
    pingHandles.delete(userId);
  }
}

export interface AddResult {
  added: boolean;
  reason?: "global_cap";
}

export function addController(
  userId: string,
  token: string,
  adAccountId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): AddResult {
  let entry = registry.get(userId);
  if (!entry) {
    if (registry.size >= GLOBAL_USER_CAP) {
      return { added: false, reason: "global_cap" };
    }
    entry = {
      controllers: [],
      lastSnapshot: new Map(),
      timerHandle: null,
      backoff: { ...INITIAL_BACKOFF },
      token,
      adAccountId,
    };
    registry.set(userId, entry);
  } else {
    entry.token = token;
    entry.adAccountId = adAccountId;
  }

  if (entry.controllers.length >= USER_CONTROLLER_CAP) {
    const oldest = entry.controllers.shift();
    if (oldest) {
      try { oldest.controller.close(); } catch {}
    }
  }
  entry.controllers.push({ controller, addedAt: Date.now() });

  startPing(userId);
  if (!entry.timerHandle) {
    runTick(userId);
  }
  return { added: true };
}

export function removeController(
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const entry = registry.get(userId);
  if (!entry) return;
  entry.controllers = entry.controllers.filter((c) => c.controller !== controller);
  if (entry.controllers.length === 0) {
    stopWorker(entry);
    stopPing(userId);
    registry.delete(userId);
  }
}

export function _resetForTest() {
  for (const [userId, entry] of registry) {
    stopWorker(entry);
    stopPing(userId);
  }
  registry.clear();
  for (const h of pingHandles.values()) clearInterval(h);
  pingHandles.clear();
}

export function _registrySize() {
  return registry.size;
}

export function _userControllerCount(userId: string) {
  return registry.get(userId)?.controllers.length ?? 0;
}

export function _fanOutForTest(userId: string, payload: NotificationPayload): number {
  const entry = registry.get(userId);
  if (!entry) return 0;
  const before = entry.controllers.length;
  fanOut(entry, payload);
  return before;
}
