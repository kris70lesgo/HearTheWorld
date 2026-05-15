"use client";

import type { AccessibilityAlert } from "@/hooks/useAudioStreamer";
import type { OneSignalSdk } from "@/types/onesignal";

type PushPayload = {
  title: string;
  message: string;
  url?: string;
  tag?: string;
  priority?: "high" | "medium" | "low";
};

type PushResult = {
  ok: boolean;
  reason?: string;
  recipients?: number;
  id?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getOneSignal(): Promise<OneSignalSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OneSignal is only available in the browser."));
  }

  if (window.__hearTheWorldOneSignal) {
    return Promise.resolve(window.__hearTheWorldOneSignal);
  }

  if (window.__hearTheWorldOneSignalReady) {
    return window.__hearTheWorldOneSignalReady;
  }

  return Promise.reject(new Error("OneSignal SDK is still loading."));
}

export async function initializeOneSignal(): Promise<PushResult> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "Browser window is unavailable." };
  }

  if (!("serviceWorker" in navigator)) {
    return { ok: false, reason: "This browser does not support service workers." };
  }

  if (!("Notification" in window)) {
    return { ok: false, reason: "This browser does not support notifications." };
  }

  try {
    const OneSignal = await getOneSignal();

    if (Notification.permission === "default") {
      if (OneSignal.Slidedown?.promptPush) {
        await OneSignal.Slidedown.promptPush({ force: true });
      } else if (OneSignal.Notifications?.requestPermission) {
        await OneSignal.Notifications.requestPermission();
      }
    }

    if (Notification.permission === "granted") {
      await OneSignal.User?.PushSubscription?.optIn?.();
      return { ok: true };
    }

    return {
      ok: false,
      reason:
        Notification.permission === "denied"
          ? "Notification permission is blocked in the browser."
          : "Notification permission was not granted.",
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "OneSignal setup failed.",
    };
  }
}

export async function getOneSignalSubscriptionId(): Promise<string | null> {
  try {
    const OneSignal = await getOneSignal();
    return OneSignal.User?.PushSubscription?.id ?? null;
  } catch {
    return null;
  }
}

async function waitForOneSignalSubscriptionId(timeoutMs = 12_000): Promise<string | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const subscriptionId = await getOneSignalSubscriptionId();
    if (subscriptionId) {
      return subscriptionId;
    }

    await sleep(500);
  }

  return null;
}

export async function sendOneSignalPush(payload: PushPayload): Promise<PushResult> {
  const permission = typeof window !== "undefined" ? Notification.permission : "denied";
  if (permission !== "granted") {
    const setup = await initializeOneSignal();
    if (!setup.ok) {
      return setup;
    }
  }

  const subscriptionId = await waitForOneSignalSubscriptionId();
  if (!subscriptionId) {
    return {
      ok: false,
      reason:
        "OneSignal subscription is not ready yet. Keep the page open for a few seconds, then try again.",
    };
  }

  try {
    const response = await fetch("/api/notifications/onesignal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        subscriptionId,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: unknown;
      recipients?: number;
      id?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        reason:
          body.error ??
          ("details" in body ? JSON.stringify(body.details) : "OneSignal push request failed."),
      };
    }

    return { ok: true, recipients: body.recipients, id: body.id };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Could not send OneSignal push.",
    };
  }
}

export async function sendAlertPush(alert: AccessibilityAlert): Promise<PushResult> {
  return sendOneSignalPush({
    title: alert.priority === "high" ? "Urgent sound detected" : "Sound detected",
    message: alert.message,
    tag: `hear-the-world-${alert.sound.toLowerCase().replaceAll(" ", "-")}`,
    priority: alert.priority,
    url: "/",
  });
}

export async function sendTestPush(): Promise<PushResult> {
  return sendOneSignalPush({
    title: "HearTheWorld test alert",
    message: "Browser push notifications are connected.",
    tag: "hear-the-world-test",
    priority: "medium",
    url: "/",
  });
}
