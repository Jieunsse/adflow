import { useState, useEffect, useCallback, useRef } from "react";
import type { WinnerEvidence } from "@entities/insights/winner-types";

export type { WinnerEvidence };

// server = 서버에 저장한 알림 (정책서 17.2). 승인 요청·판정 끝남처럼 화면을 닫아 둔 동안 생긴 일도 남는다.
export type NotifType = "launch" | "opt" | "perf" | "weekly" | "ad-status" | "auto-relaunch-ready" | "server";

export interface Notification {
  id: string;
  type: NotifType;
  message: string;
  ts: number;
  adId?: string;
  campaignId?: string;
  transition?: string;
  evidence?: WinnerEvidence;
  link?: string; // server 알림 — 누르면 가는 화면
}

export type NotifSettings = {
  launch: boolean;
  perf: boolean;
  weekly: boolean;
  opt: boolean;
  adStatus: boolean;
  autoRelaunch: boolean;
};

const NOTIF_KEY = "adflow_notifications_v1";
const SETTINGS_KEY = "adflow_notif_settings_v1";
const READ_KEY = "adflow_notif_read_v1";
const MAX_NOTIFS = 20;

export const DEFAULT_NOTIF_SETTINGS: NotifSettings = {
  launch: true,
  perf: true,
  weekly: false,
  opt: true,
  adStatus: true,
  autoRelaunch: true,
};

function loadNotifs(): Notification[] {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? "[]"); }
  catch { return []; }
}

export function loadNotifSettings(): NotifSettings {
  try { return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") }; }
  catch { return { ...DEFAULT_NOTIF_SETTINGS }; }
}

export function saveNotifSettings(s: NotifSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

function loadReadIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? "[]")); }
  catch { return new Set(); }
}

const TYPE_TO_SETTING: Record<NotifType, keyof NotifSettings> = {
  launch: "launch",
  opt: "opt",
  perf: "perf",
  weekly: "weekly",
  "ad-status": "adStatus",
  "auto-relaunch-ready": "autoRelaunch",
  server: "launch",
};

type ServerItem = { id: string; message: string; link?: string; createdAt: string; readAt?: string };

const SERVER_POLL_MS = 60_000;

export function addNotification(notif: Omit<Notification, "id" | "ts"> & { id?: string; ts?: number }) {
  const settings = loadNotifSettings();
  if (!settings[TYPE_TO_SETTING[notif.type]]) return;
  const { id, ts, ...rest } = notif;
  const n: Notification = {
    ...rest,
    id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: ts ?? Date.now(),
  };
  try {
    const existing = loadNotifs();
    if (existing.some((p) => p.id === n.id)) return;
    const next = [n, ...existing].slice(0, MAX_NOTIFS);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new CustomEvent("adflow:notification"));
}

export function useNotifications() {
  const [local, setLocal] = useState<Notification[]>([]);
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());
  const [server, setServer] = useState<Notification[]>([]);
  const [serverRead, setServerRead] = useState<Set<string>>(new Set());
  // 둘러보기·백엔드 없는 환경은 401/503 이다. 그때는 다시 묻지 않는다.
  const serverOff = useRef(false);

  const reload = useCallback(() => {
    setLocal(loadNotifs());
    setLocalRead(loadReadIds());
  }, []);

  const loadServer = useCallback(async () => {
    if (serverOff.current) return;
    const res = await fetch("/api/notifications").catch(() => null);
    if (res && (res.status === 401 || res.status === 503)) serverOff.current = true;
    if (!res?.ok) return;
    const { items } = (await res.json()) as { items: ServerItem[] };
    setServer(items.map((i) => ({ id: `srv-${i.id}`, type: "server", message: i.message, ts: Date.parse(i.createdAt), link: i.link })));
    setServerRead(new Set(items.filter((i) => i.readAt).map((i) => `srv-${i.id}`)));
  }, []);

  useEffect(() => {
    reload();
    void loadServer();
    const onNew = () => { reload(); void loadServer(); };
    window.addEventListener("adflow:notification", onNew);
    window.addEventListener("adflow:notification:read", onNew);
    const timer = window.setInterval(() => void loadServer(), SERVER_POLL_MS);
    return () => {
      window.removeEventListener("adflow:notification", onNew);
      window.removeEventListener("adflow:notification:read", onNew);
      window.clearInterval(timer);
    };
  }, [reload, loadServer]);

  const markAllRead = useCallback(() => {
    try {
      const ids = loadNotifs().map((n) => n.id);
      localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch {}
    void fetch("/api/notifications/read-all", { method: "POST" })
      .catch(() => null)
      .finally(() => window.dispatchEvent(new CustomEvent("adflow:notification:read")));
  }, []);

  const notifs = [...server, ...local].sort((a, b) => b.ts - a.ts);
  const readSet = new Set([...localRead, ...serverRead]);
  const unreadCount = notifs.filter((n) => !readSet.has(n.id)).length;

  return { notifs, readSet, unreadCount, markAllRead };
}

export function useNotifSettings() {
  const [settings, setSettings] = useState<NotifSettings>(DEFAULT_NOTIF_SETTINGS);

  useEffect(() => {
    setSettings(loadNotifSettings());
  }, []);

  const update = useCallback((key: keyof NotifSettings, val: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: val };
      saveNotifSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}
