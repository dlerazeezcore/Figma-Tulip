import { Capacitor } from "@capacitor/core";

const APP_URL_SCHEME = "com.theesim.app";
const CHECKOUT_PATH = "/checkout";

export function isNativeApp(): boolean {
  try {
    if (typeof Capacitor?.isNativePlatform === "function") {
      return Boolean(Capacitor.isNativePlatform());
    }
  } catch {
    // Fall back to window.Capacitor below.
  }

  const maybeCapacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(maybeCapacitor?.isNativePlatform?.());
}

export function getCheckoutReturnUrl(status: "success" | "cancelled"): string {
  if (isNativeApp()) {
    return `${APP_URL_SCHEME}://checkout?payment=${status}`;
  }

  const url = new URL(CHECKOUT_PATH, window.location.origin);
  url.searchParams.set("payment", status);
  return url.toString();
}

export function getRouteFromAppUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${APP_URL_SCHEME}:`) {
      return null;
    }

    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : `/${parsed.host}`;
    return `${path}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

async function importCapacitorModule<T>(moduleName: string): Promise<T | null> {
  try {
    return await import(/* @vite-ignore */ moduleName) as T;
  } catch {
    return null;
  }
}

export async function addAppUrlOpenListener(
  onOpen: (event: { url: string }) => void | Promise<void>,
): Promise<{ remove: () => Promise<void> | void } | null> {
  const capacitorApp = await importCapacitorModule<{
    App?: {
      addListener: (
        eventName: string,
        listener: (event: { url: string }) => void | Promise<void>,
      ) => Promise<{ remove: () => Promise<void> | void }> | { remove: () => Promise<void> | void };
    };
  }>("@capacitor/app");

  if (!capacitorApp?.App?.addListener) {
    return null;
  }

  return await capacitorApp.App.addListener("appUrlOpen", onOpen);
}

export async function openNativeBrowser(url: string): Promise<boolean> {
  const browserModule = await importCapacitorModule<{
    Browser?: {
      open: (options: { url: string }) => Promise<void>;
    };
  }>("@capacitor/browser");

  if (!browserModule?.Browser?.open) {
    return false;
  }

  await browserModule.Browser.open({ url });
  return true;
}

export async function closeNativeBrowser(): Promise<void> {
  const browserModule = await importCapacitorModule<{
    Browser?: {
      close: () => Promise<void>;
    };
  }>("@capacitor/browser");

  await browserModule?.Browser?.close?.();
}
