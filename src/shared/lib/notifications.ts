import { useState, useEffect, useCallback } from "react";

export type NotifType = "launch" | "opt" | "perf" | "weekly" | "ad-status";

export interface Notification {
  id: string;
  type: NotifType;
  message: string;
  ts: number;
  adId?: string;
  campaignId?: string;
  transition?: string;
}

export type NotifSettings = {
  launch: boolean;
  perf: boolean;
  weekly: boolean;
  opt: boolean;
  adStatus: boolean;
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
};

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
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    setNotifs(loadNotifs());
    setReadSet(loadReadIds());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("adflow:notification", reload);
    window.addEventListener("adflow:notification:read", reload);
    return () => {
      window.removeEventListener("adflow:notification", reload);
      window.removeEventListener("adflow:notification:read", reload);
    };
  }, [reload]);

  const markAllRead = useCallback(() => {
    try {
      const ids = loadNotifs().map((n) => n.id);
      localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch {}
    window.dispatchEvent(new CustomEvent("adflow:notification:read"));
  }, []);

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
