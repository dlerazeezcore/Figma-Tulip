import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type ActionPerformed,
  type PermissionState,
  type Token,
} from "@capacitor/push-notifications";
import { isBackendCapabilityEnabled } from "./config";
import * as client from "./esim-app-client";
import { getUserId } from "./session";

const PUSH_NOTIFICATIONS_ENABLED_KEY = "settings.notifications.enabled";
const PUSH_INSTALL_ID_KEY = "push.installId";
const PUSH_TOKEN_KEY = "push.deviceToken";
const PUSH_LAST_PROMPTED_VERSION_KEY = "push.lastPromptedVersion";
const PUSH_LAST_RESOLVED_APP_VERSION_KEY = "push.lastResolvedAppVersion";
const PUSH_CONTEXT_SYNC_THROTTLE_MS = 20 * 1000;

let listenersRegistered = false;
let lastPushContextSignature = "";
let lastPushContextSyncedAt = 0;

export interface PushPreferenceResult {
  enabled: boolean;
  reason?:
    | "unsupported"
    | "granted"
    | "denied"
    | "registering"
    | "disabled"
    | "error";
}

function shouldIgnoreMissingPushBackend(error: unknown): boolean {
  const message = String(
    error instanceof Error ? error.message : error || "",
  ).trim().toLowerCase();

  return (
    message.includes("not found") ||
    message.includes("html instead of json") ||
    message.includes("non-json response")
  );
}

function readStorage(key: string): string {
  try {
    return String(localStorage.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = readStorage(key).toLowerCase();
  if (!raw) {
    return fallback;
  }
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function readStoredPushNotificationsEnabledPreference(fallback = false): boolean {
  return readBoolean(PUSH_NOTIFICATIONS_ENABLED_KEY, fallback);
}

export function writeStoredPushNotificationsEnabledPreference(value: boolean): void {
  writeStorage(PUSH_NOTIFICATIONS_ENABLED_KEY, value ? "1" : "0");
}

function hasStoredPushNotificationsEnabledPreference(): boolean {
  return readStorage(PUSH_NOTIFICATIONS_ENABLED_KEY) !== "";
}

function isPushPlatform(platform: string): platform is "ios" | "android" {
  return platform === "ios" || platform === "android";
}

export function isNativePushSupported(): boolean {
  const platform = Capacitor.getPlatform();
  return isPushPlatform(platform);
}

function createRandomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Ignore crypto failures and fall back below.
  }

  return `push-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getPushInstallId(): string {
  const existing = readStorage(PUSH_INSTALL_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = createRandomId();
  writeStorage(PUSH_INSTALL_ID_KEY, next);
  return next;
}

function getStoredPushToken(): string {
  return readStorage(PUSH_TOKEN_KEY);
}

function setStoredPushToken(token: string): void {
  const value = String(token || "").trim();
  if (!value) {
    removeStorage(PUSH_TOKEN_KEY);
    return;
  }
  writeStorage(PUSH_TOKEN_KEY, value);
}

function getCurrentPlatform(): "ios" | "android" | "web" {
  const platform = Capacitor.getPlatform();
  return isPushPlatform(platform) ? platform : "web";
}

function getCurrentLocale(): string {
  try {
    return String(navigator.language || "").trim();
  } catch {
    return "";
  }
}

function getCurrentAppVersion(): string {
  const env = (import.meta as any)?.env || {};
  return String(env.VITE_APP_VERSION || env.MODE || "").trim();
}

async function resolveCurrentAppVersion(): Promise<string> {
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await CapacitorApp.getInfo();
      const version = String(info.version || "").trim();
      const build = String(info.build || "").trim();
      const resolved = [version, build].filter(Boolean).join("+");
      if (resolved) {
        writeStorage(PUSH_LAST_RESOLVED_APP_VERSION_KEY, resolved);
        return resolved;
      }
    }
  } catch {
    // Fall back below.
  }

  const fallback = getCurrentAppVersion();
  if (fallback) {
    writeStorage(PUSH_LAST_RESOLVED_APP_VERSION_KEY, fallback);
  }
  return fallback;
}

function getStoredResolvedAppVersion(): string {
  return readStorage(PUSH_LAST_RESOLVED_APP_VERSION_KEY);
}

function getLastPromptedAppVersion(): string {
  return readStorage(PUSH_LAST_PROMPTED_VERSION_KEY);
}

function setLastPromptedAppVersion(version: string): void {
  const next = String(version || "").trim();
  if (!next) {
    removeStorage(PUSH_LAST_PROMPTED_VERSION_KEY);
    return;
  }
  writeStorage(PUSH_LAST_PROMPTED_VERSION_KEY, next);
}

function buildDevicePayload(overrides: Record<string, unknown> = {}) {
  return {
    installId: getPushInstallId(),
    token: getStoredPushToken() || undefined,
    platform: getCurrentPlatform(),
    locale: getCurrentLocale(),
    appVersion: getStoredResolvedAppVersion() || getCurrentAppVersion(),
    notificationsEnabled: readStoredPushNotificationsEnabledPreference(false),
    userId: getUserId() || "",
    ...overrides,
  };
}

function hasPushRegistrationAuthContext(): boolean {
  // Backend supports both authenticated and guest push-device registration.
  return true;
}

async function syncDeviceRecord(overrides: Record<string, unknown> = {}): Promise<void> {
  const response = await client.syncPushDevice(buildDevicePayload(overrides));
  if (!response.success) {
    const detail = String(response.error || "").trim();
    throw new Error(detail || "Failed to sync push registration");
  }
}

async function unregisterDeviceRecord(): Promise<void> {
  const response = await client.unregisterPushDevice({
    installId: getPushInstallId(),
    token: getStoredPushToken() || undefined,
    userId: "",
    platform: getCurrentPlatform(),
  });

  if (!response.success) {
    const detail = String(response.error || "").trim();
    throw new Error(detail || "Failed to disable push notifications");
  }
}

async function createDefaultChannels(): Promise<void> {
  if (getCurrentPlatform() !== "android") {
    return;
  }

  await Promise.all([
    PushNotifications.createChannel({
      id: "offers",
      name: "Offers",
      description: "Promotions and new plan offers",
      importance: 5,
      visibility: 1,
    }),
    PushNotifications.createChannel({
      id: "orders",
      name: "Orders",
      description: "Purchase, activation, and top-up updates",
      importance: 5,
      visibility: 1,
    }),
    PushNotifications.createChannel({
      id: "support",
      name: "Support",
      description: "Replies from support and urgent account help",
      importance: 4,
      visibility: 1,
    }),
    PushNotifications.createChannel({
      id: "general",
      name: "General",
      description: "General app notifications",
      importance: 4,
      visibility: 1,
    }),
  ]);
}

function normalizeRoute(value: unknown): string {
  const route = String(value || "").trim();
  return route.startsWith("/") ? route : "";
}

function normalizeExternalUrl(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return /^https:\/\//i.test(text) ? text : "";
}

function isUpdateStyleNotification(data: Record<string, unknown>): boolean {
  const kindSignals = [
    data.kind,
    data.type,
    data.category,
    data.notificationType,
    data.notification_type,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  return /\b(update|app_update|force_update|upgrade)\b/.test(kindSignals);
}

function buildPushContextSignature(): string {
  return JSON.stringify({
    installId: getPushInstallId(),
    token: getStoredPushToken(),
    userId: getUserId() || "",
    platform: getCurrentPlatform(),
    notificationsEnabled: readStoredPushNotificationsEnabledPreference(false),
    appVersion: getStoredResolvedAppVersion() || getCurrentAppVersion(),
  });
}

function shouldThrottlePushContextSync(): boolean {
  const signature = buildPushContextSignature();
  const now = Date.now();
  if (
    signature === lastPushContextSignature &&
    now - lastPushContextSyncedAt < PUSH_CONTEXT_SYNC_THROTTLE_MS
  ) {
    return true;
  }
  return false;
}

function markPushContextSynced(): void {
  lastPushContextSignature = buildPushContextSignature();
  lastPushContextSyncedAt = Date.now();
}

async function openExternalNotificationUrl(url: string): Promise<void> {
  if (!url || typeof window === "undefined") {
    return;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url });
      return;
    } catch {
      // Fall back to normal navigation if Browser open fails.
    }
  }

  window.location.assign(url);
}

function handleNotificationAction(action: ActionPerformed): void {
  const data = (action.notification?.data || {}) as Record<string, unknown>;
  const notificationType = String(data.type || data.kind || "").trim().toLowerCase();
  if (notificationType === "app_update") {
    const iosUrl = normalizeExternalUrl(data.appStoreUrl || data.iosExternalUrl || data.iosUrl);
    const androidUrl = normalizeExternalUrl(data.playStoreUrl || data.androidExternalUrl || data.androidUrl);
    const platform = getCurrentPlatform();
    const targetUrl =
      platform === "ios"
        ? iosUrl
        : platform === "android"
        ? androidUrl
        : (iosUrl || androidUrl);

    if (targetUrl) {
      void openExternalNotificationUrl(targetUrl);
      return;
    }
  }

  if (notificationType === "support_reply") {
    if (typeof window !== "undefined") {
      const target = "/support";
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (current !== target) {
        window.location.assign(target);
      }
    }
    return;
  }

  const route = normalizeRoute(
    data.route ||
      data.path ||
      data.deeplink,
  );
  const externalUrl = normalizeExternalUrl(data.externalUrl || data.url);
  const shouldPreferExternal = externalUrl && (isUpdateStyleNotification(data) || !route);

  if (shouldPreferExternal) {
    void openExternalNotificationUrl(externalUrl);
    return;
  }

  if (route && typeof window !== "undefined") {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== route) {
      window.location.assign(route);
    }
    return;
  }

  if (!externalUrl) {
    return;
  }

  void openExternalNotificationUrl(externalUrl);
}

async function handleRegistration(token: Token): Promise<void> {
  const value = String(token?.value || "").trim();
  if (!value) {
    return;
  }

  setStoredPushToken(value);
  if (hasPushRegistrationAuthContext()) {
    try {
      await syncDeviceRecord({
        token: value,
        notificationsEnabled: true,
      });
      markPushContextSynced();
    } catch (error) {
      if (shouldIgnoreMissingPushBackend(error)) {
        console.warn("Push token registered locally, but backend push sync route is unavailable.");
        return;
      }
      throw error;
    }
  }
}

function ensurePushListeners(): void {
  if (listenersRegistered || !isNativePushSupported()) {
    return;
  }

  listenersRegistered = true;

  void PushNotifications.addListener("registration", (token) => {
    void handleRegistration(token).catch((error) => {
      console.error("Failed to sync push registration:", error);
    });
  });

  void PushNotifications.addListener("registrationError", (error) => {
    console.error("Push registration error:", error);
  });

  void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    handleNotificationAction(action);
  });
}

async function getNotificationPermission(): Promise<PermissionState> {
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt") {
    permission = await PushNotifications.requestPermissions();
  }
  return permission.receive;
}

async function requestNotificationPermissionForVersion(version: string): Promise<PermissionState> {
  const permission = await getNotificationPermission();
  setLastPromptedAppVersion(version);
  return permission;
}

export async function bootstrapPushNotifications(): Promise<void> {
  if (!isBackendCapabilityEnabled("pushNotifications")) {
    return;
  }

  if (!isNativePushSupported()) {
    return;
  }

  ensurePushListeners();
  await createDefaultChannels();
  const appVersion = await resolveCurrentAppVersion();
  const lastPromptedVersion = getLastPromptedAppVersion();
  const permissionState = await PushNotifications.checkPermissions();
  const hasStoredPreference = hasStoredPushNotificationsEnabledPreference();
  const hasStoredToken = Boolean(getStoredPushToken());

  if (hasStoredPreference && !readStoredPushNotificationsEnabledPreference(false) && permissionState.receive === "granted" && !hasStoredToken) {
    // Recover from previously disabled local preference while OS permission is already granted.
    writeStoredPushNotificationsEnabledPreference(true);
  }

  const shouldPromptOnUpdate =
    permissionState.receive === "prompt" &&
    Boolean(appVersion) &&
    appVersion !== lastPromptedVersion;
  const shouldRecoverPrompt =
    permissionState.receive === "prompt" &&
    !readStoredPushNotificationsEnabledPreference(false) &&
    !hasStoredToken;

  // First native launch: ask once and default to enabled when the user allows it.
  if (!hasStoredPushNotificationsEnabledPreference() || shouldPromptOnUpdate || shouldRecoverPrompt) {
    const permission =
      permissionState.receive === "prompt"
        ? await requestNotificationPermissionForVersion(appVersion)
        : permissionState.receive;
    const enabled = permission === "granted";
    writeStoredPushNotificationsEnabledPreference(enabled);

    if (!enabled) {
      if (hasPushRegistrationAuthContext()) {
        await syncDeviceRecord({
          appVersion,
          notificationsEnabled: false,
        }).catch((error) => {
          if (!shouldIgnoreMissingPushBackend(error)) {
            console.warn("Initial push disable sync failed:", error);
          }
        });
      }
      return;
    }

    await PushNotifications.register();

    const token = getStoredPushToken();
    if (token && hasPushRegistrationAuthContext()) {
      try {
        await syncDeviceRecord({
          appVersion,
          token,
          notificationsEnabled: true,
        });
      } catch (error) {
        if (!shouldIgnoreMissingPushBackend(error)) {
          throw error;
        }
      }
    }
    return;
  }

  if (!readStoredPushNotificationsEnabledPreference(false)) {
    return;
  }

  const permission = await PushNotifications.checkPermissions();
  if (permission.receive !== "granted") {
    return;
  }

  await PushNotifications.register();

  const token = getStoredPushToken();
  if (token && hasPushRegistrationAuthContext()) {
    try {
      await syncDeviceRecord({
        appVersion,
        token,
        notificationsEnabled: true,
      });
    } catch (error) {
      if (!shouldIgnoreMissingPushBackend(error)) {
        throw error;
      }
    }
  }
}

export async function updatePushNotificationsPreference(enabled: boolean): Promise<PushPreferenceResult> {
  if (!isBackendCapabilityEnabled("pushNotifications")) {
    writeStoredPushNotificationsEnabledPreference(false);
    return {
      enabled: false,
      reason: "unsupported",
    };
  }

  writeStoredPushNotificationsEnabledPreference(enabled);
  const appVersion = await resolveCurrentAppVersion();

  if (!isNativePushSupported()) {
    return {
      enabled,
      reason: "unsupported",
    };
  }

  ensurePushListeners();

  if (!enabled) {
    if (hasPushRegistrationAuthContext()) {
      try {
        await unregisterDeviceRecord();
      } catch (error) {
        if (!shouldIgnoreMissingPushBackend(error)) {
          throw error;
        }
        console.warn("Push backend unregister route is unavailable; disabled locally only.");
      }
    }
    try {
      await PushNotifications.unregister();
    } catch {
      // Best-effort native unregister.
    }

    return {
      enabled: false,
      reason: "disabled",
    };
  }

  await createDefaultChannels();

  const permission = await requestNotificationPermissionForVersion(appVersion);
  if (permission !== "granted") {
    writeStoredPushNotificationsEnabledPreference(false);
    if (hasPushRegistrationAuthContext()) {
      await syncDeviceRecord({
        appVersion,
        notificationsEnabled: false,
      }).catch((error) => {
        if (!shouldIgnoreMissingPushBackend(error)) {
          console.warn("Push permission denial sync failed:", error);
        }
      });
    }

    return {
      enabled: false,
      reason: "denied",
    };
  }

  await PushNotifications.register();

  const token = getStoredPushToken();
  if (token && hasPushRegistrationAuthContext()) {
    try {
      await syncDeviceRecord({
        appVersion,
        token,
        notificationsEnabled: true,
      });
    } catch (error) {
      if (!shouldIgnoreMissingPushBackend(error)) {
        throw error;
      }
      console.warn("Push enabled locally, but backend push sync route is unavailable.");
    }
  }

  return {
    enabled: true,
    reason: token ? "granted" : "registering",
  };
}

export async function syncPushUserContext(): Promise<void> {
  if (!isBackendCapabilityEnabled("pushNotifications")) {
    return;
  }

  if (!isNativePushSupported()) {
    return;
  }

  if (shouldThrottlePushContextSync()) {
    return;
  }

  ensurePushListeners();
  const appVersion = await resolveCurrentAppVersion();
  const permission = await PushNotifications.checkPermissions();
  let enabled = readStoredPushNotificationsEnabledPreference(false);

  if (!enabled && permission.receive === "granted" && !getStoredPushToken()) {
    // Auto-heal once permission is granted at OS level but local toggle remained false.
    writeStoredPushNotificationsEnabledPreference(true);
    enabled = true;
  }

  if (!enabled) {
    if (hasPushRegistrationAuthContext()) {
      await syncDeviceRecord({
        appVersion,
        notificationsEnabled: false,
        userId: "",
      }).catch((error) => {
        if (!shouldIgnoreMissingPushBackend(error)) {
          console.warn("Push disabled-state sync failed:", error);
        }
      });
    }
    markPushContextSynced();
    return;
  }

  if (permission.receive !== "granted") {
    return;
  }

  await createDefaultChannels();

  const token = getStoredPushToken();
  if (token && hasPushRegistrationAuthContext()) {
    try {
      await syncDeviceRecord({
        appVersion,
        token,
        notificationsEnabled: true,
      });
      markPushContextSynced();
    } catch (error) {
      if (!shouldIgnoreMissingPushBackend(error)) {
        throw error;
      }
      console.warn("Push user-context sync skipped because backend route is unavailable.");
    }
    return;
  }

  await PushNotifications.register();
  markPushContextSynced();
}
