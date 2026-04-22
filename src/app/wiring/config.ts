import { Capacitor } from "@capacitor/core";
import { NATIVE_PUSH_CONFIG } from "./generated-native-push-config";

const DEFAULT_NATIVE_API_BASE = "https://mean-lettie-corevia-0bd7cc91.koyeb.app/api/v1";
const DEFAULT_WEB_API_BASE = "/api/v1";

const BACKEND_CAPABILITIES = {
  supportChat: true,
  pushNotifications: true,
  currencySettings: true,
  whitelistSettings: true,
  homeTutorial: false,
  fibPayments: true,
} as const;

export type BackendCapability = keyof typeof BACKEND_CAPABILITIES;

function normalizeBaseUrl(value: string): string {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return text.endsWith("/") ? text.slice(0, -1) : text;
}

function readLocalStorage(key: string): string {
  try {
    return String(localStorage.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function readEnv(key: string): string {
  const env = (import.meta as any)?.env || {};
  return String(env[key] || "").trim();
}

function readEnvBoolean(key: string): boolean {
  const value = readEnv(key).toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeBaseUrl(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push(normalized);
  });

  return out;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isNativeRuntime(): boolean {
  try {
    if (Capacitor.isNativePlatform()) {
      return true;
    }
    const platform = Capacitor.getPlatform();
    return platform === "ios" || platform === "android";
  } catch {
    const maybeCapacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(maybeCapacitor?.isNativePlatform?.());
  }
}

function isFigmaWebRuntime(): boolean {
  try {
    const host = String(window.location.hostname || "").toLowerCase();
    return (
      host.includes("figma.site") ||
      host.includes("makeproxy-m.figma.site") ||
      host.includes("figma.com")
    );
  } catch {
    return false;
  }
}

export function getApiBaseCandidates(): string[] {
  const figmaRuntime = isFigmaWebRuntime();
  const allowLocalOverride = readEnvBoolean("VITE_ALLOW_LOCAL_API_BASE_OVERRIDE");
  const fromStorage = figmaRuntime || !allowLocalOverride ? "" : readLocalStorage("esimApiBaseUrl");
  const fromEnv = readEnv("VITE_ESIM_API_BASE_URL");
  const nativeRuntime = isNativeRuntime();
  const defaults = nativeRuntime || figmaRuntime
    ? [DEFAULT_NATIVE_API_BASE]
    : [DEFAULT_WEB_API_BASE, DEFAULT_NATIVE_API_BASE];

  const candidates = dedupe([
    fromStorage,
    fromEnv,
    ...defaults,
  ]);

  if (nativeRuntime || figmaRuntime) {
    return candidates.filter(isAbsoluteHttpUrl);
  }

  return candidates;
}

export function getPrimaryApiBaseUrl(): string {
  return getApiBaseCandidates()[0] || DEFAULT_NATIVE_API_BASE;
}

export function getFibBaseCandidates(): string[] {
  const allowLocalOverride = readEnvBoolean("VITE_ALLOW_LOCAL_API_BASE_OVERRIDE");
  const fromStorage = allowLocalOverride ? readLocalStorage("fibApiBaseUrl") : "";
  const fromEnv = readEnv("VITE_FIB_API_BASE_URL");

  // Some routes may be rooted at API origin instead of /api/v1.
  const apiBase = getPrimaryApiBaseUrl();
  let apiOrigin = "";
  try {
    if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
      apiOrigin = new URL(apiBase).origin;
    }
  } catch {
    apiOrigin = "";
  }

  return dedupe([fromStorage, fromEnv, apiOrigin]);
}

export function isBackendCapabilityEnabled(capability: BackendCapability): boolean {
  return Boolean(BACKEND_CAPABILITIES[capability]);
}

export function getNativePushUnavailableReason(): string {
  if (!isBackendCapabilityEnabled("pushNotifications")) {
    return "Push notifications are disabled for this app build.";
  }

  try {
    const platform = Capacitor.getPlatform();
    if (platform === "ios" && !NATIVE_PUSH_CONFIG.ios.enabled) {
      return "iOS push notifications need the Push Notifications capability and APNs entitlements in Xcode.";
    }
    if (platform === "android" && !NATIVE_PUSH_CONFIG.android.enabled) {
      return "Android push notifications need android/app/google-services.json from the Firebase project before they can be enabled.";
    }
  } catch {
    // Fall through to the generic message below.
  }

  return "Push notifications are only available in the native iOS and Android apps.";
}

export function isNativePushConfigured(): boolean {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === "ios") {
      return NATIVE_PUSH_CONFIG.ios.enabled;
    }
    if (platform === "android") {
      return NATIVE_PUSH_CONFIG.android.enabled;
    }
  } catch {
    return false;
  }

  return false;
}

export function isNativePushEnabled(): boolean {
  try {
    return isBackendCapabilityEnabled("pushNotifications") && isNativePushConfigured();
  } catch {
    return false;
  }
}
