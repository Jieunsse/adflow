"use client";

import { useNotificationStream } from "@shared/lib/useNotificationStream";

export default function NotificationStreamMount() {
  useNotificationStream();
  return null;
}
