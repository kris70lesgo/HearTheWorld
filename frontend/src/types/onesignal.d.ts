export type OneSignalPermissionChangeEvent = boolean | { permission?: boolean };

export type OneSignalSdk = {
  init(options: {
    appId: string;
    serviceWorkerPath?: string;
    serviceWorkerParam?: { scope: string };
    serviceWorkerUpdaterPath?: string;
    allowLocalhostAsSecureOrigin?: boolean;
  }): Promise<void>;
  Slidedown?: {
    promptPush(options?: { force?: boolean }): Promise<void>;
  };
  Notifications?: {
    permission?: boolean;
    requestPermission(): Promise<boolean>;
    addEventListener(
      event: "permissionChange",
      callback: (event: OneSignalPermissionChangeEvent) => void,
    ): void;
  };
  User?: {
    PushSubscription?: {
      id?: string | null;
      token?: string | null;
      optedIn?: boolean;
      optIn(): Promise<void>;
      addEventListener(
        event: "change",
        callback: () => void,
      ): void;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalSdk) => void | Promise<void>>;
    __hearTheWorldOneSignal?: OneSignalSdk;
    __hearTheWorldOneSignalReady?: Promise<OneSignalSdk>;
  }
}

export {};
