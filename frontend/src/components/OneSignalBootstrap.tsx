"use client";

import { useEffect } from "react";

const ONE_SIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "67b7ec41-d3ba-46c5-8587-a16eb62317ef";
const ONE_SIGNAL_SDK_SRC = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

function loadOneSignalScript(onError: (error: Error) => void) {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${ONE_SIGNAL_SDK_SRC}"]`,
  );
  if (existing) {
    return;
  }

  const script = document.createElement("script");
  script.src = ONE_SIGNAL_SDK_SRC;
  script.async = true;
  script.onerror = () => {
    onError(new Error("OneSignal SDK script could not load. Check Brave Shields or ad blockers."));
  };
  document.head.appendChild(script);
}

export default function OneSignalBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined" || window.__hearTheWorldOneSignalReady) {
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.__hearTheWorldOneSignalReady = new Promise((resolve, reject) => {
      window.OneSignalDeferred?.push(async (OneSignal) => {
        try {
          await OneSignal.init({
            appId: ONE_SIGNAL_APP_ID,
            serviceWorkerPath: "/OneSignalSDKWorker.js",
            serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
            serviceWorkerParam: { scope: "/" },
            allowLocalhostAsSecureOrigin: true,
          });
          window.__hearTheWorldOneSignal = OneSignal;
          resolve(OneSignal);
        } catch (error) {
          reject(error instanceof Error ? error : new Error("OneSignal init failed."));
        }
      });
      window.setTimeout(() => {
        if (!window.__hearTheWorldOneSignal) {
          reject(new Error("OneSignal SDK did not become ready. Check Brave Shields or ad blockers."));
        }
      }, 15000);
    });
    window.__hearTheWorldOneSignalReady.catch(() => undefined);

    loadOneSignalScript((error) => {
      window.__hearTheWorldOneSignalReady = Promise.reject(error);
      window.__hearTheWorldOneSignalReady.catch(() => undefined);
    });
  }, []);

  return null;
}
