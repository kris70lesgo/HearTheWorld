import type { AccessibilityAlert } from "@/hooks/useAudioStreamer";
import { sendAlertPush } from "@/lib/onesignal";

export const IMPORTANT_PUSH_SOUNDS = [
  "Baby cry",
  "Crying",
  "Knock",
  "Doorbell",
  "Thunderstorm",
  "Shouting",
  "Screaming",
  "Siren",
  "Alarm",
  "Fire alarm",
  "Smoke detector",
  "Glass breaking",
  "Gunshot, gunfire",
  "Explosion",
  "Vehicle horn",
  "Impact",
] as const;

const NOTIFIABLE_SOUNDS = new Set<string>(IMPORTANT_PUSH_SOUNDS);

export function shouldSendBrowserPush(alert: AccessibilityAlert): boolean {
  if (alert.priority === "high") {
    return true;
  }

  return NOTIFIABLE_SOUNDS.has(alert.sound);
}

export async function notifyDetectedSound(alert: AccessibilityAlert) {
  if (!shouldSendBrowserPush(alert)) {
    return {
      ok: true,
      skipped: true,
      reason: `${alert.sound} is not configured for browser push.`,
      recipients: undefined,
    };
  }

  return sendAlertPush(alert);
}
