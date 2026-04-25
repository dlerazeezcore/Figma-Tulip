import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  getAllDestinations,
  getCountryPlans,
} from "./catalog-service";
import { getApiBaseCandidates, getFibBaseCandidates } from "./config";
import { activateEsim, getMyEsims, topUpEsim } from "./orders-service";
import { requestApi } from "./http";
import { clearAuthSession, getUserId } from "./session";
import type { ApiResponse } from "./types";

export type MyEsimStatus = "active" | "inactive" | "expired" | "pending";
export type MyEsimTab = "active" | "inactive" | "expired";

export interface MyEsimItem {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  orderReference: string;
  transactionId: string;
  flag: string;
  status: MyEsimStatus;
  rawStatus: string;
  isInstalled: boolean;
  dataUsed: number;
  dataTotal: number;
  dataRemaining: number;
  daysLeft: number;
  hasDaysLeft: boolean;
  validityDays: number;
  validUntil: string;
  iccid: string;
  activatedDate: string;
  activationCode: string;
  installUrl: string;
  activationUrl: string;
  qrPayload: string;
  hasTopUp: boolean;
  topUpPlanId: string;
  canShowQr: boolean;
  canActivate: boolean;
  canTopUp: boolean;
}

interface LoadMyEsimsOptions {
  includeTopUpSupport?: boolean;
  includeOrderLifecycle?: boolean;
  includeDestinationLookup?: boolean;
}

export interface MyEsimsPageModel {
  esims: MyEsimItem[];
  activeEsims: MyEsimItem[];
  inactiveEsims: MyEsimItem[];
  expiredEsims: MyEsimItem[];
  loading: boolean;
  busyEsimId: string;
  selectedTab: MyEsimTab;
  selectedQrEsim: MyEsimItem | null;
  setSelectedTab: (value: MyEsimTab) => void;
  setSelectedQrEsim: (value: MyEsimItem | null) => void;
  refresh: (force?: boolean) => Promise<void>;
  handleActivate: (esim: MyEsimItem) => Promise<void>;
  handleTopUp: (esim: MyEsimItem) => Promise<void>;
}

interface TopUpSupport {
  hasTopUp: boolean;
  planId: string;
}

interface OrderLifecycle {
  status: string;
  statusMessage: string;
  raw: unknown;
}

interface CachedOrderLifecycle extends OrderLifecycle {
  cachedAt: number;
}

const MY_ESIMS_SNAPSHOT_KEY_PREFIX = "esim.myEsims.snapshot.v2.";
const MY_ESIMS_SHADOW_ROWS_KEY_PREFIX = "esim.myEsims.shadowRows.v1.";
const ORDER_LIFECYCLE_CACHE_KEY = "esim.orderLifecycle.cache.v1";
const ACTIVATION_PENDING_CACHE_KEY = "esim.activation.pending.v1";
const ORDER_LIFECYCLE_TIMEOUT_MS = 3500;
const ORDER_LIFECYCLE_CONCURRENCY = 10;
const ORDER_BACKFILL_TIMEOUT_MS = 2000;
const TOPUP_LOOKUP_TIMEOUT_MS = 1500;
const ESIMS_REFRESH_THROTTLE_MS = 25_000;
const ACTIVATION_PENDING_TTL_MS = 30 * 60 * 1000;
const MY_ESIMS_SHADOW_TTL_MS = 10 * 24 * 60 * 60 * 1000;
const topUpSupportCache = new Map<string, TopUpSupport>();

function readMyEsimsSnapshot(): MyEsimItem[] {
  try {
    const uid = getUserId();
    if (!uid) return [];
    const raw = localStorage.getItem(MY_ESIMS_SNAPSHOT_KEY_PREFIX + uid);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeMyEsimsSnapshot(items: MyEsimItem[]): void {
  try {
    const uid = getUserId();
    if (!uid) return;
    localStorage.setItem(MY_ESIMS_SNAPSHOT_KEY_PREFIX + uid, JSON.stringify(items));
  } catch { /* ignore */ }
}

function getMyEsimsShadowKey(): string {
  const uid = String(getUserId() || "").trim();
  return uid ? `${MY_ESIMS_SHADOW_ROWS_KEY_PREFIX}${uid}` : "";
}

function readMyEsimsShadowRows(): any[] {
  try {
    const key = getMyEsimsShadowKey();
    if (!key) {
      return [];
    }
    const raw = String(localStorage.getItem(key) || "").trim();
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const now = Date.now();
    return parsed.filter((entry: any) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      const createdAt = Number(entry.__shadowCreatedAt || 0);
      if (!Number.isFinite(createdAt) || createdAt <= 0) {
        return false;
      }
      return now - createdAt <= MY_ESIMS_SHADOW_TTL_MS;
    });
  } catch {
    return [];
  }
}

function writeMyEsimsShadowRows(rows: any[]): void {
  try {
    const key = getMyEsimsShadowKey();
    if (!key) {
      return;
    }
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // Ignore storage failures.
  }
}

function getRowIdentityKey(row: any): string {
  if (!row || typeof row !== "object") {
    return "";
  }

  const raw = row?.raw && typeof row.raw === "object" ? row.raw : row;
  return String(
    row?.orderReference ||
      row?.provider_order_no ||
      row?.providerOrderNo ||
      row?.esim_tran_no ||
      row?.esimTranNo ||
      row?.iccid ||
      raw?.orderReference ||
      raw?.provider_order_no ||
      raw?.providerOrderNo ||
      raw?.esim_tran_no ||
      raw?.esimTranNo ||
      raw?.iccid ||
      row?.id ||
      raw?.id ||
      "",
  ).trim();
}

function mergeRowsByIdentity(baseRows: any[], extraRows: any[]): any[] {
  const base = Array.isArray(baseRows) ? baseRows : [];
  const extra = Array.isArray(extraRows) ? extraRows : [];
  if (extra.length === 0) {
    return base;
  }

  const merged = new Map<string, any>();
  [...base, ...extra].forEach((row, index) => {
    const key = getRowIdentityKey(row) || `fallback_${index + 1}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, row);
      return;
    }

    const currentActivated = Boolean(String(current?.activated_at || current?.activatedAt || "").trim());
    const nextActivated = Boolean(String(row?.activated_at || row?.activatedAt || "").trim());
    if (nextActivated && !currentActivated) {
      merged.set(key, row);
      return;
    }

    const currentInstalled = toBoolean(current?.installed ?? current?.installed_at ?? current?.installedAt);
    const nextInstalled = toBoolean(row?.installed ?? row?.installed_at ?? row?.installedAt);
    if (nextInstalled && !currentInstalled) {
      merged.set(key, row);
      return;
    }

    const currentCustomSize = Object.keys(current?.custom_fields || current?.customFields || {}).length;
    const nextCustomSize = Object.keys(row?.custom_fields || row?.customFields || {}).length;
    if (nextCustomSize > currentCustomSize) {
      merged.set(key, row);
    }
  });

  return Array.from(merged.values());
}

function mergeRowsWithShadowProfiles(rows: any[]): any[] {
  const apiRows = Array.isArray(rows) ? rows : [];
  const shadowRows = readMyEsimsShadowRows();
  if (shadowRows.length === 0) {
    return apiRows;
  }

  const apiKeys = new Set(apiRows.map((row) => getRowIdentityKey(row)).filter(Boolean));
  const unresolvedShadows = shadowRows.filter((row) => {
    const key = getRowIdentityKey(row);
    if (!key) {
      return false;
    }
    return !apiKeys.has(key);
  });

  if (unresolvedShadows.length !== shadowRows.length) {
    writeMyEsimsShadowRows(unresolvedShadows);
  }

  if (unresolvedShadows.length === 0) {
    return apiRows;
  }

  return mergeRowsByIdentity(apiRows, unresolvedShadows);
}

function buildOrderStatusBaseCandidates(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (value: string) => {
    const normalized = String(value || "").trim();
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  };

  const resolveOrigin = (value: string): string => {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    if (text.startsWith("http://") || text.startsWith("https://")) {
      try {
        return new URL(text).origin;
      } catch {
        return "";
      }
    }
    return "";
  };

  [...getApiBaseCandidates(), ...getFibBaseCandidates()].forEach((base) => {
    const origin = resolveOrigin(base);
    if (origin) {
      add(origin);
    }
  });

  // Same-origin proxy as fallback (primarily for local dev reverse proxy).
  add("");

  return result;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function flagFromIso(code: string): string {
  const iso = String(code || "").trim().toUpperCase();
  if (iso.length !== 2) {
    return "🌍";
  }
  return String.fromCodePoint(127397 + iso.charCodeAt(0), 127397 + iso.charCodeAt(1));
}

function resolveDisplayFlag(rawFlag: unknown, code: string): string {
  const candidate = String(rawFlag || "").trim();
  if (!candidate || candidate.includes("\uFFFD") || /^\?+$/.test(candidate)) {
    return flagFromIso(code);
  }
  return candidate;
}

function toTimeoutApiResponse<T = any>(): ApiResponse<T> {
  return { success: false, error: "Order lifecycle lookup timed out" };
}

function toTimeoutTopUpResponse<T = any>(): ApiResponse<T> {
  return { success: false, error: "Top-up lookup timed out" };
}

function isTerminalLifecycle(lifecycle: OrderLifecycle): boolean {
  const signals = `${lifecycle.status} ${lifecycle.statusMessage} ${JSON.stringify(lifecycle.raw ?? "")}`.toLowerCase();
  return /\b(expired|refund|refunded|refunding|rfd|cancel|cancelled|canceled|cancelling|canceling|cnl|revoke|revoked|revoking|rvk|void|voided|terminated|closed)\b/.test(signals);
}

function hasTerminalSignals(value: unknown): boolean {
  const signals = String(value ?? "").toLowerCase();
  return /\b(expired|refund|refunded|refunding|rfd|cancel|cancelled|canceled|cancelling|canceling|cnl|revoke|revoked|revoking|rvk|void|voided|terminated|closed)\b/.test(signals);
}

function isHiddenLifecycleStatus(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return [
    "expired",
    "cancelled",
    "canceled",
    "refunded",
    "revoked",
    "voided",
    "closed",
  ].some((status) => normalized.includes(status));
}

function shouldBucketEsimAsExpired(item: Pick<MyEsimItem, "status" | "rawStatus">): boolean {
  return item.status === "expired" || isHiddenLifecycleStatus(`${item.status} ${item.rawStatus}`);
}

function safeSignalBlob(value: unknown): string {
  try {
    return JSON.stringify(value ?? "").toLowerCase();
  } catch {
    return String(value ?? "").toLowerCase();
  }
}

function getOrderReferenceFromSources(...sources: Array<any>): string {
  for (const source of sources) {
    if (!source || typeof source !== "object") {
      continue;
    }

    const candidates = [
      source.orderReference,
      source.order_reference,
      source.orderNo,
      source.order_no,
      source.orderId,
      source.order_id,
      source.orderCode,
      source.order_code,
      source.readableCode,
      source.readable_code,
      source.orderRef,
      source.order_ref,
      source.referenceCode,
      source.reference_code,
      source.reference,
      source.code,
      source.raw?.orderReference,
      source.raw?.order_reference,
      source.raw?.orderNo,
      source.raw?.order_no,
      source.raw?.orderId,
      source.raw?.order_id,
      source.raw?.readableCode,
      source.raw?.readable_code,
      source.raw?.orderRef,
      source.raw?.order_ref,
      source.raw?.reference,
      source.raw?.obj?.orderNo,
      source.raw?.obj?.order_id,
      source.raw?.obj?.orderReference,
      source.raw?.obj?.order_reference,
      source.raw?.obj?.orderCode,
      source.raw?.obj?.order_code,
      source.raw?.obj?.reference,
      source.raw?.obj?.referenceCode,
      source.raw?.obj?.txnNo,
      source.raw?.obj?.transactionId,
    ];

    for (const candidate of candidates) {
      const value = String(candidate || "").trim();
      if (value) {
        return value;
      }
    }
  }

  return "";
}

function getLifecycleLookupKeys(...sources: Array<any>): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  const add = (value: unknown) => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) {
      return;
    }
    seen.add(text);
    keys.push(text);
  };

  add(getOrderReferenceFromSources(...sources));

  sources.forEach((source) => {
    if (!source || typeof source !== "object") {
      return;
    }

    add(source.iccid);
    add(source.id);
    add(source.activationCode);
    add(source.qrCode);
    add(source.raw?.iccid);
    add(source.raw?.id);
    add(source.raw?.activationCode);
    add(source.raw?.qrCode);
    add(source.raw?.obj?.iccid);
    add(source.raw?.obj?.id);
  });

  return keys;
}

function findCachedLifecycle(
  cache: Map<string, CachedOrderLifecycle>,
  keys: string[],
): CachedOrderLifecycle | undefined {
  for (const key of keys) {
    const cached = cache.get(key);
    if (canUseCachedLifecycle(cached)) {
      return cached;
    }
  }

  return undefined;
}

function findLifecycleForKeys(
  lifecycleByLookupKey: Map<string, OrderLifecycle>,
  keys: string[],
): OrderLifecycle | null {
  for (const key of keys) {
    const lifecycle = lifecycleByLookupKey.get(key);
    if (lifecycle) {
      return lifecycle;
    }
  }

  return null;
}

function assignLifecycleToKeys(
  target: Map<string, OrderLifecycle>,
  keys: string[],
  lifecycle: OrderLifecycle,
): void {
  keys.forEach((key) => {
    target.set(key, lifecycle);
  });
}

function readOrderLifecycleCache(): Map<string, CachedOrderLifecycle> {
  try {
    const raw = String(localStorage.getItem(ORDER_LIFECYCLE_CACHE_KEY) || "");
    if (!raw) {
      return new Map<string, CachedOrderLifecycle>();
    }

    const parsed = JSON.parse(raw) as Record<string, CachedOrderLifecycle>;
    const entries = Object.entries(parsed || {}).filter(([_, value]) => {
      if (!value || typeof value !== "object") {
        return false;
      }
      const hasStatus = typeof value.status === "string";
      const hasCachedAt = Number.isFinite(Number(value.cachedAt));
      return hasStatus && hasCachedAt;
    });

    return new Map<string, CachedOrderLifecycle>(
      entries.map(([reference, value]) => [
        reference,
        {
          status: String(value.status || ""),
          statusMessage: String(value.statusMessage || ""),
          raw: value.raw ?? null,
          cachedAt: Number(value.cachedAt),
        },
      ]),
    );
  } catch {
    return new Map<string, CachedOrderLifecycle>();
  }
}

function applyCachedOrderLifecycle(list: any[]): any[] {
  const cache = readOrderLifecycleCache();
  if (cache.size === 0) {
    return list;
  }

  return list.map((row) => {
    const keys = getLifecycleLookupKeys(row, row?.raw);
    const cached = findCachedLifecycle(cache, keys);
    if (!cached) {
      return row;
    }

    return {
      ...row,
      orderLifecycle: cached,
      orderStatus: cached.status || row?.orderStatus || row?.status || "",
      raw: {
        ...(row?.raw && typeof row.raw === "object" ? row.raw : {}),
        orderLifecycle: cached,
        orderStatus: cached.status || row?.raw?.orderStatus || row?.raw?.status || "",
      },
    };
  });
}

function writeOrderLifecycleCache(cache: Map<string, CachedOrderLifecycle>): void {
  try {
    const payload: Record<string, CachedOrderLifecycle> = {};
    cache.forEach((value, reference) => {
      payload[reference] = value;
    });
    localStorage.setItem(ORDER_LIFECYCLE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

function readActivationPendingCache(): Map<string, number> {
  try {
    const now = Date.now();
    const raw = String(localStorage.getItem(ACTIVATION_PENDING_CACHE_KEY) || "");
    if (!raw) {
      return new Map<string, number>();
    }

    const parsed = JSON.parse(raw) as Record<string, number>;
    return new Map<string, number>(
      Object.entries(parsed || {})
        .map(([key, value]) => [key, Number(value)] as const)
        .filter(([key, timestamp]) => {
          if (!key || !Number.isFinite(timestamp) || timestamp <= 0) {
            return false;
          }
          return now - timestamp <= ACTIVATION_PENDING_TTL_MS;
        }),
    );
  } catch {
    return new Map<string, number>();
  }
}

function writeActivationPendingCache(cache: Map<string, number>): void {
  try {
    const payload: Record<string, number> = {};
    cache.forEach((value, key) => {
      payload[key] = value;
    });
    localStorage.setItem(ACTIVATION_PENDING_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

function buildActivationPendingKey(parts: Array<unknown>): string {
  return parts
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

function markActivationPending(parts: Array<unknown>): void {
  const key = buildActivationPendingKey(parts);
  if (!key) {
    return;
  }

  const cache = readActivationPendingCache();
  cache.set(key, Date.now());
  writeActivationPendingCache(cache);
}

function clearActivationPending(parts: Array<unknown>): void {
  const key = buildActivationPendingKey(parts);
  if (!key) {
    return;
  }

  const cache = readActivationPendingCache();
  if (!cache.delete(key)) {
    return;
  }
  writeActivationPendingCache(cache);
}

function canUseCachedLifecycle(cached: CachedOrderLifecycle | undefined): cached is CachedOrderLifecycle {
  if (!cached) {
    return false;
  }
  // Use cache only for terminal outcomes. Non-terminal states can quickly become refunded/cancelled,
  // so they should be revalidated against provider lifecycle endpoint on each refresh.
  return isTerminalLifecycle(cached);
}

function extractNumber(value: unknown, fallback = 0): number {
  const text = String(value ?? "");
  const matched = text.match(/-?\d+(\.\d+)?/);
  if (!matched) {
    return fallback;
  }
  return toNumber(matched[0], fallback);
}

function toBoolean(value: unknown): boolean {
  if (value === true || value === false) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }

  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return false;
  }

  if (["false", "0", "no", "n", "off", "not installed", "inactive"].includes(text)) {
    return false;
  }

  return ["true", "1", "yes", "y", "on", "installed", "active"].includes(text);
}

function parseObjectCandidate(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : {};
  } catch {
    return {};
  }
}

function toPositiveInt(value: unknown): number {
  const parsed = Math.floor(extractNumber(value, 0));
  return parsed > 0 ? parsed : 0;
}

function pickSmallestPositiveInt(values: unknown[]): number {
  let best = 0;
  values.forEach((value) => {
    const candidate = toPositiveInt(value);
    if (candidate <= 0) {
      return;
    }
    if (best === 0 || candidate < best) {
      best = candidate;
    }
  });
  return best;
}

function parseDateToMs(value: unknown): number {
  const text = String(value || "").trim();
  if (!text) {
    return Number.NaN;
  }

  if (/^\d{13}$/.test(text)) {
    const ms = Number(text);
    return Number.isFinite(ms) ? ms : Number.NaN;
  }
  if (/^\d{10}$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? seconds * 1000 : Number.NaN;
  }

  // Some providers return timezone as +0000; normalize to +00:00 for Date.parse compatibility.
  const normalized = text.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function computeBundleDaysLeftFromActivation(activatedAt: unknown, validityDays: number): number {
  if (validityDays <= 0) {
    return -1;
  }
  const activatedAtMs = parseDateToMs(activatedAt);
  if (!Number.isFinite(activatedAtMs)) {
    return -1;
  }

  const elapsedMs = Math.max(0, Date.now() - activatedAtMs);
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return Math.max(0, validityDays - elapsedDays);
}

function computeBundleExpiresAtIso(activatedAt: unknown, validityDays: number): string {
  if (validityDays <= 0) {
    return "";
  }
  const activatedAtMs = parseDateToMs(activatedAt);
  if (!Number.isFinite(activatedAtMs)) {
    return "";
  }
  return new Date(activatedAtMs + validityDays * 24 * 60 * 60 * 1000).toISOString();
}

function resolveBundleValidityDays(row: any, raw: any): number {
  const directCandidates: unknown[] = [
    row?.packageValidityDays,
    row?.package_validity_days,
    row?.planValidityDays,
    row?.plan_validity_days,
    row?.durationDays,
    row?.duration_days,
    row?.totalDuration,
    row?.total_duration,
    row?.validityDays,
    row?.validity_days,
    row?.validity,
    row?.duration,
    raw?.packageValidityDays,
    raw?.package_validity_days,
    raw?.planValidityDays,
    raw?.plan_validity_days,
    raw?.durationDays,
    raw?.duration_days,
    raw?.totalDuration,
    raw?.total_duration,
    raw?.validityDays,
    raw?.validity_days,
    raw?.validity,
    raw?.duration,
    row?.customFields?.packageValidityDays,
    row?.customFields?.package_validity_days,
    row?.customFields?.planValidityDays,
    row?.customFields?.plan_validity_days,
    row?.customFields?.durationDays,
    row?.customFields?.duration_days,
    row?.customFields?.totalDuration,
    row?.customFields?.total_duration,
    row?.customFields?.validityDays,
    row?.customFields?.validity_days,
    row?.customFields?.validity,
    row?.custom_fields?.packageValidityDays,
    row?.custom_fields?.package_validity_days,
    row?.custom_fields?.planValidityDays,
    row?.custom_fields?.plan_validity_days,
    row?.custom_fields?.durationDays,
    row?.custom_fields?.duration_days,
    row?.custom_fields?.totalDuration,
    row?.custom_fields?.total_duration,
    row?.custom_fields?.validityDays,
    row?.custom_fields?.validity_days,
    row?.custom_fields?.validity,
    raw?.customFields?.packageValidityDays,
    raw?.customFields?.package_validity_days,
    raw?.customFields?.planValidityDays,
    raw?.customFields?.plan_validity_days,
    raw?.customFields?.durationDays,
    raw?.customFields?.duration_days,
    raw?.customFields?.totalDuration,
    raw?.customFields?.total_duration,
    raw?.customFields?.validityDays,
    raw?.customFields?.validity_days,
    raw?.customFields?.validity,
    raw?.custom_fields?.packageValidityDays,
    raw?.custom_fields?.package_validity_days,
    raw?.custom_fields?.planValidityDays,
    raw?.custom_fields?.plan_validity_days,
    raw?.custom_fields?.durationDays,
    raw?.custom_fields?.duration_days,
    raw?.custom_fields?.totalDuration,
    raw?.custom_fields?.total_duration,
    raw?.custom_fields?.validityDays,
    raw?.custom_fields?.validity_days,
    raw?.custom_fields?.validity,
  ];

  const snapshotSources = [
    row?.purchaseSnapshot,
    row?.purchase_snapshot,
    row?.checkoutSnapshot,
    row?.checkout_snapshot,
    raw?.purchaseSnapshot,
    raw?.purchase_snapshot,
    raw?.checkoutSnapshot,
    raw?.checkout_snapshot,
    row?.customFields?.checkoutSnapshot,
    row?.customFields?.checkout_snapshot,
    row?.custom_fields?.checkoutSnapshot,
    row?.custom_fields?.checkout_snapshot,
    raw?.customFields?.checkoutSnapshot,
    raw?.customFields?.checkout_snapshot,
    raw?.custom_fields?.checkoutSnapshot,
    raw?.custom_fields?.checkout_snapshot,
  ];

  const snapshotCandidates: unknown[] = [];
  snapshotSources.forEach((source) => {
    const snapshot = parseObjectCandidate(source);
    if (Object.keys(snapshot).length === 0) {
      return;
    }
    const plan = parseObjectCandidate(snapshot?.plan);
    snapshotCandidates.push(
      snapshot?.validity,
      snapshot?.validityDays,
      snapshot?.validity_days,
      snapshot?.duration,
      snapshot?.durationDays,
      snapshot?.duration_days,
      snapshot?.planValidityDays,
      snapshot?.plan_validity_days,
      plan?.validity,
      plan?.validityDays,
      plan?.validity_days,
      plan?.duration,
      plan?.durationDays,
      plan?.duration_days,
    );
  });

  return pickSmallestPositiveInt([...directCandidates, ...snapshotCandidates]);
}

function normalizeStatusToken(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isTopUpStatusEligible(statusValue: unknown): boolean {
  const normalized = normalizeStatusToken(statusValue);
  if (!normalized) {
    return false;
  }

  if (normalized === "active" || normalized === "suspended") {
    return true;
  }

  if (
    normalized === "got_resource" ||
    normalized === "inactive" ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled") ||
    normalized.includes("revoked") ||
    normalized.includes("refunded")
  ) {
    return false;
  }

  return false;
}

function resolveSupportTopUpType(row: any, raw: any): number {
  const values = [
    row?.supportTopUpType,
    row?.support_top_up_type,
    raw?.supportTopUpType,
    raw?.support_top_up_type,
    row?.customFields?.supportTopUpType,
    row?.custom_fields?.supportTopUpType,
    row?.custom_fields?.support_top_up_type,
    raw?.customFields?.supportTopUpType,
    raw?.custom_fields?.supportTopUpType,
    raw?.custom_fields?.support_top_up_type,
  ];

  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }

  return 0;
}

function hasValidActivatedDate(value: unknown): boolean {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  const normalized = text.toLowerCase();
  if (["0", "null", "undefined", "n/a", "na", "-", "--"].includes(normalized)) {
    return false;
  }

  if (/^\d{10,13}$/.test(text)) {
    return true;
  }

  const parsedMs = Date.parse(text);
  return Number.isFinite(parsedMs);
}

function normalizeInstallUrl(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (raw.toLowerCase().includes("p.qrsim.net/") && raw.toLowerCase().endsWith(".png")) {
    return raw.slice(0, -4);
  }

  return raw;
}

function buildAppleActivationUrl(cardData: string): string {
  return `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(cardData)}`;
}

function extractActivationCardData(installUrl: string, activationCode: string): string {
  const directCode = String(activationCode || "").trim();
  if (directCode && /^lpa:/i.test(directCode)) {
    return directCode;
  }

  const normalizedInstallUrl = normalizeInstallUrl(installUrl);
  if (!normalizedInstallUrl) {
    return directCode;
  }

  if (/^lpa:/i.test(normalizedInstallUrl)) {
    return normalizedInstallUrl;
  }

  try {
    const parsed = new URL(normalizedInstallUrl);
    const cardData = String(parsed.searchParams.get("carddata") || "").trim();
    if (cardData) {
      return cardData;
    }
  } catch {
    // Ignore malformed URLs and fall back below.
  }

  return directCode;
}

function flagToCountryCode(flag: string): string {
  const symbols = Array.from(String(flag || ""));
  if (symbols.length !== 2) {
    return "";
  }

  const codePoints = symbols.map((symbol) => symbol.codePointAt(0) || 0);
  if (codePoints.some((point) => point < 127462 || point > 127487)) {
    return "";
  }

  return String.fromCharCode(codePoints[0] - 127397, codePoints[1] - 127397);
}

function buildCountryCodeByName(destinations: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const rows = Array.isArray(destinations) ? destinations : [];

  rows.forEach((row: any) => {
    const type = String(row?.type || "").toLowerCase();
    if (type && type !== "country") {
      return;
    }

    const code = String(row?.code || row?.iso || "").trim().toUpperCase();
    const name = String(row?.name || "").trim().toLowerCase();

    if (!name || code.length !== 2) {
      return;
    }

    map.set(name, code);
  });

  return map;
}

function readSnapshotCountryCode(...sources: any[]): string {
  for (const source of sources) {
    if (!source || typeof source !== "object") {
      continue;
    }
    const snapshot = source?.purchaseSnapshot && typeof source.purchaseSnapshot === "object"
      ? source.purchaseSnapshot
      : {};
    const country = snapshot?.country && typeof snapshot.country === "object"
      ? snapshot.country
      : {};

    const code = String(
      snapshot?.countryCode ||
      snapshot?.country_code ||
      country?.code ||
      country?.iso ||
      "",
    ).trim().toUpperCase();
    if (code.length === 2) {
      return code;
    }
  }

  return "";
}

function readSnapshotCountryName(...sources: any[]): string {
  for (const source of sources) {
    if (!source || typeof source !== "object") {
      continue;
    }
    const snapshot = source?.purchaseSnapshot && typeof source.purchaseSnapshot === "object"
      ? source.purchaseSnapshot
      : {};
    const country = snapshot?.country && typeof snapshot.country === "object"
      ? snapshot.country
      : {};

    const name = String(
      snapshot?.countryName ||
      snapshot?.country_name ||
      country?.name ||
      snapshot?.country ||
      "",
    ).trim();
    if (name) {
      return name;
    }
  }

  return "";
}

function resolveCountryCode(row: any, raw: any, countryCodeByName: Map<string, string>): string {
  const snapshotCode = readSnapshotCountryCode(row, raw);
  if (snapshotCode.length === 2) {
    return snapshotCode;
  }

  const customCode = String(
    row?.customFields?.countryCode ||
    row?.customFields?.country_code ||
    row?.custom_fields?.countryCode ||
    row?.custom_fields?.country_code ||
    row?.purchaseSnapshot?.countryCode ||
    row?.purchaseSnapshot?.country_code ||
    raw?.customFields?.countryCode ||
    raw?.customFields?.country_code ||
    raw?.custom_fields?.countryCode ||
    raw?.custom_fields?.country_code ||
    raw?.purchaseSnapshot?.countryCode ||
    raw?.purchaseSnapshot?.country_code ||
    ""
  ).trim().toUpperCase();

  if (customCode.length === 2) {
    return customCode;
  }

  const explicit = String(
    raw?.countryCode || raw?.country_code || row?.countryCode || row?.code || row?.iso || "",
  )
    .trim()
    .toUpperCase();

  if (explicit.length === 2) {
    return explicit;
  }

  const countryName = String(
    readSnapshotCountryName(row, raw) ||
    row?.customFields?.country ||
    row?.customFields?.countryName ||
    row?.customFields?.country_name ||
    row?.custom_fields?.country ||
    row?.custom_fields?.countryName ||
    row?.custom_fields?.country_name ||
    row?.purchaseSnapshot?.country ||
    row?.purchaseSnapshot?.countryName ||
    row?.purchaseSnapshot?.country_name ||
    raw?.customFields?.country ||
    raw?.customFields?.countryName ||
    raw?.customFields?.country_name ||
    raw?.custom_fields?.country ||
    raw?.custom_fields?.countryName ||
    raw?.custom_fields?.country_name ||
    raw?.purchaseSnapshot?.country ||
    raw?.purchaseSnapshot?.countryName ||
    raw?.purchaseSnapshot?.country_name ||
    raw?.country || row?.country || ""
  ).trim();
  if (countryName) {
    const fromName = countryCodeByName.get(countryName.toLowerCase());
    if (fromName && fromName.length === 2) {
      return fromName;
    }
  }

  const fromFlag = flagToCountryCode(String(raw?.flag || row?.flag || ""));
  if (fromFlag.length === 2) {
    return fromFlag;
  }

  const fromCountryValue = countryName.toUpperCase();
  if (fromCountryValue.length === 2) {
    return fromCountryValue;
  }

  return "";
}

function buildActivationInstallUrl(installUrl: string, activationCode: string): string {
  const cardData = extractActivationCardData(installUrl, activationCode);
  if (cardData && /^lpa:/i.test(cardData)) {
    return buildAppleActivationUrl(cardData);
  }

  const normalizedInstallUrl = normalizeInstallUrl(installUrl);
  if (normalizedInstallUrl && /^lpa:/i.test(normalizedInstallUrl)) {
    return normalizedInstallUrl;
  }

  return "";
}

function isNativeIosRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const maybeCapacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  const isNative = Boolean(maybeCapacitor?.isNativePlatform?.());
  if (!isNative) {
    return false;
  }

  const userAgent = String(window.navigator?.userAgent || "").toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

function buildPreferredActivationUrl(installUrl: string, activationCode: string): string {
  const cardData = extractActivationCardData(installUrl, activationCode);
  if (isNativeIosRuntime() && cardData) {
    return buildAppleActivationUrl(cardData);
  }

  return buildActivationInstallUrl(installUrl, activationCode);
}

function normalizeActivationLaunchUrl(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/^lpa:/i.test(text)) {
    return text;
  }

  if (/^https:\/\/esimsetup\.apple\.com\/esim_qrcode_provisioning/i.test(text)) {
    return text;
  }

  return "";
}

function resolveActivationLaunchUrl(esim: Partial<MyEsimItem>, responseRow?: any): string {
  const responseRaw = responseRow?.raw && typeof responseRow.raw === "object" ? responseRow.raw : responseRow || {};

  const candidates = [
    buildPreferredActivationUrl(
      String(responseRaw?.installUrl || responseRow?.installUrl || esim.installUrl || ""),
      String(responseRaw?.activationCode || responseRow?.activationCode || esim.activationCode || ""),
    ),
    normalizeActivationLaunchUrl(responseRaw?.activationUrl || responseRow?.activationUrl),
    normalizeActivationLaunchUrl(responseRaw?.installUrl || responseRow?.installUrl),
    normalizeActivationLaunchUrl(esim.activationUrl),
    normalizeActivationLaunchUrl(esim.installUrl),
    normalizeActivationLaunchUrl(esim.qrPayload),
  ];

  return candidates.find(Boolean) || "";
}

function buildQrPayload(installUrl: string, activationCode: string, activationUrl: string): string {
  const cardData = extractActivationCardData(installUrl, activationCode);
  if (cardData && /^lpa:/i.test(cardData)) {
    return cardData;
  }

  const install = normalizeInstallUrl(installUrl);
  if (install && /^lpa:/i.test(install)) {
    return install;
  }

  if (activationUrl && /^lpa:/i.test(activationUrl)) {
    return activationUrl;
  }

  const directCode = String(activationCode || "").trim();
  if (directCode && /^lpa:/i.test(directCode)) {
    return directCode;
  }

  return "";
}

function resolveValidUntil(
  explicitValue: unknown,
  daysLeft: number,
  isActivated: boolean,
): string {
  if (!isActivated) {
    return "";
  }

  const explicit = String(explicitValue || "").trim();
  if (explicit) {
    return explicit;
  }

  if (daysLeft <= 0) {
    return "";
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Math.max(0, Math.floor(daysLeft)));
  return expiresAt.toISOString();
}

export function buildQrImageUrl(payload: string): string {
  const text = String(payload || "").trim();
  if (!text) {
    return "";
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(text)}`;
}

function normalizeMyEsim(
  row: any,
  countryCodeByName: Map<string, string>,
  topUpSupport: Map<string, TopUpSupport>,
  activationPendingCache: Map<string, number>,
): MyEsimItem {
  const raw = row?.raw && typeof row.raw === "object" ? row.raw : row || {};

  const id = String(raw?.id || row?.id || "");
  const orderReference = getOrderReferenceFromSources(row, raw);
  const transactionId = String(
    raw?.esim_tran_no ||
      raw?.esimTranNo ||
      row?.esim_tran_no ||
      row?.esimTranNo ||
      orderReference ||
      id,
  ).trim();
  const name = String(
    row?.customFields?.name || row?.custom_fields?.name || raw?.customFields?.name || raw?.custom_fields?.name ||
    row?.purchaseSnapshot?.name || raw?.purchaseSnapshot?.name ||
    row?.customFields?.country || row?.custom_fields?.country || raw?.customFields?.country || raw?.custom_fields?.country ||
    row?.purchaseSnapshot?.country || raw?.purchaseSnapshot?.country ||
    raw?.name || row?.name || raw?.country || row?.country || "My eSIM"
  );
  const country = String(
    row?.customFields?.country || row?.custom_fields?.country || raw?.customFields?.country || raw?.custom_fields?.country ||
    row?.purchaseSnapshot?.country || raw?.purchaseSnapshot?.country ||
    raw?.country || row?.country || "Unknown"
  );
  const isInstalled = toBoolean(raw?.installed ?? row?.installed);
  const rawStatus = String(raw?.status || row?.status || "inactive");

  const dataUsed = Math.max(
    0,
    extractNumber(
      row?.dataUsedMb ??
        row?.dataUsed,
      0,
    ),
  );
  const dataTotal = Math.max(
    0,
    extractNumber(
      row?.dataTotalMb ??
        row?.dataTotal ??
        row?.data,
      0,
    ),
  );
  const providedRemaining = extractNumber(
    row?.dataRemainingMb ??
      row?.dataRemaining,
    Number.NaN,
  );
  const dataRemaining = Number.isFinite(providedRemaining)
    ? Math.max(0, providedRemaining)
    : dataTotal > 0
    ? Math.max(0, dataTotal - dataUsed)
    : 0;

  const normalizedRawStatus = rawStatus.trim().toLowerCase();
  const backendDaysLeftRaw = row?.daysLeft ?? raw?.daysLeft;
  const hasBackendDaysLeft = backendDaysLeftRaw !== null && backendDaysLeftRaw !== undefined && String(backendDaysLeftRaw).trim() !== "";
  const backendDaysLeft = hasBackendDaysLeft
    ? Math.max(0, Math.floor(extractNumber(backendDaysLeftRaw, 0)))
    : -1;
  const validityDays = resolveBundleValidityDays(row, raw);
  const hiddenByStatus = isHiddenLifecycleStatus(normalizedRawStatus);
  const statusFromBackend: MyEsimStatus = hiddenByStatus
    ? "expired"
    : normalizedRawStatus === "active"
    ? "active"
    : normalizedRawStatus === "pending"
    ? "pending"
    : "inactive";

  const activationCode = String(
    raw?.activationCode ||
    raw?.activation_code ||
    row?.activationCode ||
    row?.activation_code ||
    row?.qrCode ||
    raw?.qrCode ||
    "",
  ).trim();
  const installUrl = normalizeInstallUrl(raw?.installUrl || raw?.install_url || row?.installUrl || row?.install_url);
  const activationUrl = buildActivationInstallUrl(installUrl, activationCode);
  const qrPayload = buildQrPayload(installUrl, activationCode, activationUrl);
  const activatedDate = String(
    row?.activatedAt ||
      row?.activated_at ||
      raw?.activatedAt ||
      raw?.activated_at ||
      raw?.activatedDate ||
      row?.activatedDate ||
      "",
  ).trim();
  const explicitActivationFlag = toBoolean(
    raw?.isActivated ??
      raw?.is_activated ??
      row?.isActivated ??
      row?.is_activated ??
      raw?.activated ??
      row?.activated,
  );
  const backendSaysActive = statusFromBackend === "active";
  const hasActivationDate = hasValidActivatedDate(activatedDate);
  const isActivated = isInstalled && (explicitActivationFlag || hasActivationDate || backendSaysActive);
  let hasDaysLeft = false;
  let daysLeft = -1;
  if (isActivated) {
    const bundleDaysLeft = computeBundleDaysLeftFromActivation(activatedDate, validityDays);
    if (bundleDaysLeft >= 0) {
      daysLeft = bundleDaysLeft;
      hasDaysLeft = true;
    }

    if (backendDaysLeft >= 0) {
      if (hasDaysLeft) {
        // Keep app countdown bounded by purchased bundle validity when backend/profile counters diverge.
        daysLeft = Math.min(daysLeft, backendDaysLeft);
      } else {
        daysLeft = backendDaysLeft;
        hasDaysLeft = true;
      }
    }
  }
  if (!hasDaysLeft && isActivated) {
    const fallbackExpiresAt = String(
      row?.expiresAt ||
        row?.expires_at ||
        raw?.expiresAt ||
        raw?.expires_at ||
        "",
    ).trim();
    if (fallbackExpiresAt) {
      const expiresAtMs = Date.parse(fallbackExpiresAt);
      if (Number.isFinite(expiresAtMs)) {
        const delta = expiresAtMs - Date.now();
        daysLeft = Math.max(0, Math.ceil(delta / (24 * 60 * 60 * 1000)));
        hasDaysLeft = true;
      }
    }
  }
  if (!isActivated) {
    hasDaysLeft = false;
    daysLeft = -1;
  }
  const activationPendingKeyParts = [orderReference, raw?.iccid || row?.iccid, id, activationCode];
  const displayDaysLeft = hasDaysLeft ? daysLeft : 0;
  const bundleValidUntil = computeBundleExpiresAtIso(activatedDate, validityDays);
  const lifecycleValidUntil = String(
    row?.expiresAt ||
      row?.expires_at ||
      raw?.expiresAt ||
      raw?.expires_at ||
      row?.validUntil ||
      row?.valid_until ||
      raw?.validUntil ||
      raw?.valid_until ||
      "",
  ).trim();
  const validUntil = resolveValidUntil(
    bundleValidUntil ||
      lifecycleValidUntil ||
      raw?.validUntil ||
      raw?.valid_until ||
      raw?.expiresAt ||
      raw?.expires_at ||
      row?.validUntil ||
      row?.valid_until ||
      row?.expiresAt ||
      row?.expires_at,
    displayDaysLeft,
    isActivated,
  );
  const resolvedActivatedDate = activatedDate;
  if (hiddenByStatus || isActivated) {
    clearActivationPending(activationPendingKeyParts);
  }
  const finalStatus = !isActivated
    ? "inactive"
    : hiddenByStatus
    ? "expired"
    : statusFromBackend === "active" && hasDaysLeft && daysLeft <= 0
    ? "expired"
    : statusFromBackend;

  const countryCode = resolveCountryCode(row, raw, countryCodeByName);
  const flag = resolveDisplayFlag(raw?.flag || row?.flag, countryCode);
  const supportTopUpType = resolveSupportTopUpType(row, raw);
  const backendTopUpEligibleStatus = isTopUpStatusEligible(
    raw?.status ?? row?.status ?? rawStatus ?? normalizedRawStatus,
  );
  const topUp = topUpSupport.get(countryCode) || { hasTopUp: false, planId: "" };
  const hasTopUp = supportTopUpType > 0;
  const canTopUp = hasTopUp && backendTopUpEligibleStatus && Boolean(topUp.planId);

  return {
    id,
    name,
    country,
    countryCode,
    orderReference,
    transactionId,
    flag,
    status: finalStatus,
    rawStatus,
    isInstalled: isInstalled,
    dataUsed,
    dataTotal,
    dataRemaining,
    daysLeft: displayDaysLeft,
    hasDaysLeft,
    validityDays,
    validUntil,
    iccid: String(raw?.iccid || row?.iccid || ""),
    activatedDate: resolvedActivatedDate,
    activationCode,
    installUrl,
    activationUrl,
    qrPayload,
    hasTopUp,
    topUpPlanId: hasTopUp ? topUp.planId : "",
    canShowQr: Boolean(qrPayload) && finalStatus !== "expired",
    canActivate: finalStatus !== "expired" && !isActivated && Boolean(qrPayload),
    canTopUp,
  };
}

function statusPriority(status: MyEsimStatus): number {
  if (status === "expired") {
    return 4;
  }
  if (status === "active") {
    return 3;
  }
  if (status === "pending") {
    return 2;
  }
  return 1;
}

function dedupeEsims(items: MyEsimItem[]): MyEsimItem[] {
  const byKey = new Map<string, MyEsimItem>();

  items.forEach((item, index) => {
    const key = item.orderReference || item.iccid || item.activationCode || item.id || `__fallback_${index}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, item);
      return;
    }

    const currentPriority = statusPriority(current.status);
    const nextPriority = statusPriority(item.status);

    if (nextPriority > currentPriority) {
      byKey.set(key, item);
      return;
    }

    if (nextPriority === currentPriority) {
      const currentInstalled = current.isInstalled ? 1 : 0;
      const nextInstalled = item.isInstalled ? 1 : 0;
      if (nextInstalled > currentInstalled) {
        byKey.set(key, item);
      }
    }
  });

  return Array.from(byKey.values());
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  };

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    () => runWorker(),
  );
  await Promise.all(workers);
  return results;
}

function pickTopUpPlanId(plans: any[]): string {
  const rows = Array.isArray(plans) ? plans : [];
  if (rows.length === 0) {
    return "";
  }

  const candidate = [...rows]
    .filter((row) => {
      const supportTopUpType = Number(row?.supportTopUpType ?? row?.support_top_up_type ?? 0);
      return Number.isFinite(supportTopUpType) && supportTopUpType > 0 && String(row?.id || row?.bundleName || "").trim();
    })
    .sort((a, b) => {
      const aPrice = toNumber(a?.price, Number.MAX_SAFE_INTEGER);
      const bPrice = toNumber(b?.price, Number.MAX_SAFE_INTEGER);
      return aPrice - bPrice;
    })[0] || null;

  return candidate ? String(candidate?.id || candidate?.bundleName || "").trim() : "";
}

async function loadTopUpSupport(countryCodes: string[]): Promise<Map<string, TopUpSupport>> {
  const uniqueCodes = Array.from(new Set(countryCodes.map((value) => value.trim().toUpperCase()).filter(Boolean)));
  const support = new Map<string, TopUpSupport>();

  await Promise.all(
    uniqueCodes.map(async (countryCode) => {
      if (topUpSupportCache.has(countryCode)) {
        support.set(countryCode, topUpSupportCache.get(countryCode) || { hasTopUp: false, planId: "" });
        return;
      }

      try {
        const response = await Promise.race<ApiResponse<any>>([
          getCountryPlans(countryCode),
          new Promise<ApiResponse<any>>((resolve) => {
            setTimeout(() => resolve(toTimeoutTopUpResponse()), TOPUP_LOOKUP_TIMEOUT_MS);
          }),
        ]);
        const plans = response.success && Array.isArray(response.data) ? response.data : [];
        const topUpPlans = plans.filter((row) => {
          const supportTopUpType = Number(row?.supportTopUpType ?? row?.support_top_up_type ?? 0);
          return Number.isFinite(supportTopUpType) && supportTopUpType > 0;
        });
        const resolved = {
          hasTopUp: topUpPlans.length > 0,
          planId: pickTopUpPlanId(topUpPlans),
        };
        topUpSupportCache.set(countryCode, resolved);
        support.set(countryCode, resolved);
      } catch {
        const fallback = { hasTopUp: false, planId: "" };
        topUpSupportCache.set(countryCode, fallback);
        support.set(countryCode, fallback);
      }
    }),
  );

  return support;
}

async function loadOrderLifecycleByReference(orderReference: string): Promise<OrderLifecycle | null> {
  const ref = String(orderReference || "").trim();
  if (!ref) {
    return null;
  }

  const response = await Promise.race<ApiResponse<any>>([
    requestApi<any>(`/api/esim/orders/${encodeURIComponent(ref)}`, {
      includeAuth: false,
      baseCandidates: buildOrderStatusBaseCandidates(),
    }),
    new Promise<ApiResponse<any>>((resolve) => {
      setTimeout(() => resolve(toTimeoutApiResponse()), ORDER_LIFECYCLE_TIMEOUT_MS);
    }),
  ]);

  if (!response.success || !response.data || typeof response.data !== "object") {
    return null;
  }

  return {
    status: String(
      response.data?.status ||
      response.data?.orderStatus ||
      response.data?.order_status ||
      response.data?.state ||
      response.data?.orderState ||
      "",
    ),
    statusMessage: String(
      response.data?.statusMessage ||
      response.data?.message ||
      response.data?.detail ||
      response.data?.description ||
      response.data?.remark ||
      "",
    ),
    raw: response.data ?? null,
  };
}

async function enrichRowsWithOrderLifecycle(rows: any[]): Promise<any[]> {
  const list = Array.isArray(rows) ? rows : [];
  const cache = readOrderLifecycleCache();
  const lifecycleByLookupKey = new Map<string, OrderLifecycle>();
  const rowsByReference = new Map<string, any[]>();

  list.forEach((row) => {
    const raw = row?.raw && typeof row.raw === "object" ? row.raw : row;
    const alreadyTerminal = hasTerminalSignals(
      safeSignalBlob({
        row,
        raw,
        orderLifecycle: row?.orderLifecycle || raw?.orderLifecycle || null,
      }),
    );
    if (alreadyTerminal) {
      return;
    }

    const keys = getLifecycleLookupKeys(row, raw);
    const cached = findCachedLifecycle(cache, keys);
    if (cached) {
      assignLifecycleToKeys(lifecycleByLookupKey, keys, cached);
      return;
    }

    const reference = getOrderReferenceFromSources(row, raw);
    if (!reference) {
      return;
    }

    const existing = rowsByReference.get(reference) || [];
    existing.push(row);
    rowsByReference.set(reference, existing);
  });

  if (rowsByReference.size === 0 && lifecycleByLookupKey.size === 0) {
    return list;
  }

  const fetchedLifecycle = await mapWithConcurrency(
    Array.from(rowsByReference.keys()),
    ORDER_LIFECYCLE_CONCURRENCY,
    async (orderReference) => {
      try {
        const lifecycle = await loadOrderLifecycleByReference(orderReference);
        return { orderReference, lifecycle };
      } catch {
        return { orderReference, lifecycle: null as OrderLifecycle | null };
      }
    },
  );

  fetchedLifecycle.forEach(({ orderReference, lifecycle }) => {
    const relatedRows = rowsByReference.get(orderReference) || [];
    if (lifecycle) {
      relatedRows.forEach((row) => {
        const keys = getLifecycleLookupKeys(row, row?.raw);
        assignLifecycleToKeys(lifecycleByLookupKey, keys, lifecycle);
        keys.forEach((key) => {
          cache.set(key, {
            ...lifecycle,
            cachedAt: Date.now(),
          });
        });
      });
      return;
    }

    const fallbackCached = findCachedLifecycle(cache, [orderReference]);
    if (fallbackCached) {
      relatedRows.forEach((row) => {
        assignLifecycleToKeys(lifecycleByLookupKey, getLifecycleLookupKeys(row, row?.raw), fallbackCached);
      });
    }
  });

  if (cache.size > 0) {
    writeOrderLifecycleCache(cache);
  }

  if (lifecycleByLookupKey.size === 0) {
    return list;
  }

  return list.map((row) => {
    const lifecycle = findLifecycleForKeys(lifecycleByLookupKey, getLifecycleLookupKeys(row, row?.raw));
    if (!lifecycle) {
      return row;
    }

    return {
      ...row,
      orderLifecycle: lifecycle,
      orderStatus: lifecycle.status || row?.orderStatus || row?.status || "",
      raw: {
        ...(row?.raw && typeof row.raw === "object" ? row.raw : {}),
        orderLifecycle: lifecycle,
        orderStatus: lifecycle.status || row?.raw?.orderStatus || row?.raw?.status || "",
      },
    };
  });
}

export async function loadMyEsimsPageContent(options: LoadMyEsimsOptions = {}): Promise<MyEsimItem[]> {
  const includeTopUpSupport = options.includeTopUpSupport !== false;
  const includeOrderLifecycle = options.includeOrderLifecycle !== false;
  const includeDestinationLookup = options.includeDestinationLookup !== false;

  const [myEsimsResponse, destinationsResponse] = await Promise.all([
    getMyEsims(),
    includeDestinationLookup ? getAllDestinations() : Promise.resolve<ApiResponse<any[]>>({ success: true, data: [] }),
  ]);

  if (!myEsimsResponse.success) {
    const cached = readMyEsimsSnapshot();
    if (cached.length > 0) {
      return cached;
    }
    return [];
  }

  const initialRows = Array.isArray(myEsimsResponse.data)
    ? myEsimsResponse.data
    : [];
  const mergedRows = mergeRowsWithShadowProfiles(initialRows);
  const rows = includeOrderLifecycle
    ? await enrichRowsWithOrderLifecycle(mergedRows)
    : applyCachedOrderLifecycle(mergedRows);

  const countryCodeByName = buildCountryCodeByName(destinationsResponse.success ? destinationsResponse.data : []);
  const activationPendingCache = readActivationPendingCache();

  const normalized = rows.map((row: any) =>
    normalizeMyEsim(row, countryCodeByName, new Map<string, TopUpSupport>(), activationPendingCache),
  );
  if (!includeTopUpSupport) {
    return dedupeEsims(normalized);
  }

  const topUpSupport = await loadTopUpSupport(
    normalized.map((item) => item.countryCode),
  );

  const hydrated = normalized.map((item) => {
    const topUp = topUpSupport.get(item.countryCode) || { hasTopUp: false, planId: "" };
    const hasTopUp = Boolean(item.hasTopUp) && topUp.hasTopUp;
    const canTopUp = hasTopUp && isTopUpStatusEligible(item.rawStatus) && Boolean(topUp.planId);
    return {
      ...item,
      hasTopUp,
      topUpPlanId: hasTopUp ? topUp.planId : "",
      canTopUp,
    };
  });

  return dedupeEsims(hydrated);
}

async function hydrateTopUpSupportOnEsims(items: MyEsimItem[]): Promise<MyEsimItem[]> {
  const topUpSupport = await loadTopUpSupport(
    items.map((item) => item.countryCode),
  );

  return dedupeEsims(
    items.map((item) => {
      const topUp = topUpSupport.get(item.countryCode) || { hasTopUp: false, planId: "" };
      const hasTopUp = Boolean(item.hasTopUp) && topUp.hasTopUp;
      const canTopUp = hasTopUp && isTopUpStatusEligible(item.rawStatus) && Boolean(topUp.planId);
      return {
        ...item,
        hasTopUp,
        topUpPlanId: hasTopUp ? topUp.planId : "",
        canTopUp,
      };
    }),
  );
}

function readRequestedTab(value: string | null): MyEsimTab {
  const requestedTab = String(value || "").trim().toLowerCase();
  if (requestedTab === "inactive" || requestedTab === "expired" || requestedTab === "active") {
    return requestedTab as MyEsimTab;
  }
  return "active";
}

function resolveTopUpFailureDetails(response: ApiResponse<any>): {
  message: string;
  requestId: string;
  traceId: string;
} {
  const payload = response as any;
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const message = String(
    response.error ||
      payload?.providerMessage ||
      payload?.message ||
      data?.providerMessage ||
      data?.message ||
      "Unable to top up this eSIM.",
  ).trim();
  const requestId = String(payload?.requestId || data?.requestId || "").trim();
  const traceId = String(payload?.traceId || data?.traceId || "").trim();
  return { message, requestId, traceId };
}

function isAuthFailureResponse(response: ApiResponse<any>): boolean {
  const payload = response as any;
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const errorCode = String(payload?.errorCode || data?.errorCode || "").trim().toUpperCase();
  const messageBlob = `${response.error || ""} ${payload?.message || ""} ${data?.message || ""}`.toLowerCase();
  return (
    Number(response.statusCode || 0) === 401 ||
    errorCode === "AUTH_MISSING_BEARER_TOKEN" ||
    messageBlob.includes("auth_missing_bearer_token") ||
    messageBlob.includes("session expired") ||
    messageBlob.includes("unauthorized")
  );
}

function redirectToLoginAfterSessionExpiry(): void {
  clearAuthSession();
  window.setTimeout(() => {
    window.location.assign("/settings");
  }, 250);
}

export function useMyEsimsPageModel(): MyEsimsPageModel {
  const [searchParams, setSearchParams] = useSearchParams();
  const cachedSnapshot = useMemo(() => readMyEsimsSnapshot(), []);
  const hasCachedSnapshotOnBoot = cachedSnapshot.length > 0;
  const [esims, setEsims] = useState<MyEsimItem[]>(cachedSnapshot);
  const [loading, setLoading] = useState(!hasCachedSnapshotOnBoot);
  const [busyEsimId, setBusyEsimId] = useState("");
  const [selectedTab, setSelectedTabState] = useState<MyEsimTab>(() => readRequestedTab(searchParams.get("tab")));
  const [selectedQrEsim, setSelectedQrEsim] = useState<MyEsimItem | null>(null);
  const lastRefreshAtRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const inactiveRecoveryAttemptsRef = useRef(0);
  const inactiveRecoveryTimerRef = useRef<number | null>(null);

  const activeEsims = useMemo(
    () =>
      esims.filter(
        (esim) =>
          esim.status === "active" &&
          !shouldBucketEsimAsExpired(esim) &&
          (!esim.hasDaysLeft || esim.daysLeft > 0),
      ),
    [esims],
  );
  const inactiveEsims = useMemo(
    () =>
      esims.filter(
        (esim) =>
          !shouldBucketEsimAsExpired(esim) &&
          (esim.status === "inactive" || esim.status === "pending"),
      ),
    [esims],
  );
  const expiredEsims = useMemo(() => esims.filter((esim) => shouldBucketEsimAsExpired(esim)), [esims]);

  const loadVerifiedEsims = async () => {
    try {
      const verifiedRows = await loadMyEsimsPageContent({
        includeOrderLifecycle: true,
        includeTopUpSupport: false,
      });
      setEsims(verifiedRows);
      setLoading(false);
      lastRefreshAtRef.current = Date.now();
      writeMyEsimsSnapshot(verifiedRows);

      const hydratedRows = await hydrateTopUpSupportOnEsims(verifiedRows);
      setEsims(hydratedRows);
      writeMyEsimsSnapshot(hydratedRows);
    } catch (error) {
      console.warn("My eSIM refresh failed; keeping cached snapshot.", error);
      const cached = readMyEsimsSnapshot();
      if (cached.length > 0) {
        setEsims(cached);
      }
      setLoading(false);
    }
  };

  const refreshEsims = async (showLoader = false, force = false) => {
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < ESIMS_REFRESH_THROTTLE_MS) {
      return;
    }

    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    const task = (async () => {
      if (showLoader) {
        setLoading(true);
      }
      await loadVerifiedEsims();
    })().finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = task;
    await task;
  };

  const loadFastEsims = async () => {
    try {
      const fastRows = await loadMyEsimsPageContent({
        includeOrderLifecycle: false,
        includeTopUpSupport: false,
      });
      setEsims(fastRows);
      setLoading(false);
    } catch (error) {
      console.warn("Fast My eSIM load failed; keeping cached snapshot.", error);
      const cached = readMyEsimsSnapshot();
      if (cached.length > 0) {
        setEsims(cached);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedTabState(readRequestedTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (inactiveRecoveryTimerRef.current !== null) {
        window.clearTimeout(inactiveRecoveryTimerRef.current);
        inactiveRecoveryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (selectedTab !== "inactive" || loading || inactiveEsims.length > 0) {
      inactiveRecoveryAttemptsRef.current = 0;
      if (inactiveRecoveryTimerRef.current !== null) {
        window.clearTimeout(inactiveRecoveryTimerRef.current);
        inactiveRecoveryTimerRef.current = null;
      }
      return;
    }

    if (inactiveRecoveryTimerRef.current !== null) {
      return;
    }

    const attempt = inactiveRecoveryAttemptsRef.current;
    if (attempt >= 3) {
      return;
    }

    const delays = [900, 2100, 4200];
    const delayMs = delays[attempt] ?? delays[delays.length - 1];
    inactiveRecoveryTimerRef.current = window.setTimeout(() => {
      inactiveRecoveryTimerRef.current = null;
      inactiveRecoveryAttemptsRef.current += 1;
      void refreshEsims(false, true);
    }, delayMs);
  }, [selectedTab, loading, inactiveEsims.length]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!hasCachedSnapshotOnBoot) {
        setLoading(true);
        await loadFastEsims();
      } else {
        setLoading(false);
      }
      if (!mounted) {
        return;
      }
      await refreshEsims(false, true);
    };

    const handleResume = () => {
      if (!mounted) {
        return;
      }
      void refreshEsims(false, false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleResume();
      }
    };

    void load();
    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasCachedSnapshotOnBoot]);

  const setSelectedTab = (value: MyEsimTab) => {
    setSelectedTabState(value);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", value);
    setSearchParams(nextParams, { replace: true });
  };

  const markEsimPendingInUi = (esim: MyEsimItem) => {
    setEsims((current) =>
      current.map((item) =>
        item.id === esim.id
          ? {
              ...item,
              status: "inactive",
              isInstalled: false,
              activatedDate: "",
              canActivate: true,
              canTopUp: false,
            }
          : item,
      ),
    );
    setSelectedTab("inactive");
  };

  const handleActivate = async (esim: MyEsimItem) => {
    if (!esim.canActivate) {
      toast.error("This eSIM is already activated.");
      return;
    }

    setBusyEsimId(esim.id);
    const response = await activateEsim(esim.id, esim.iccid, esim.transactionId);
    setBusyEsimId("");

    if (!response.success && !resolveActivationLaunchUrl(esim)) {
      toast.error("Activation failed", {
        description: response.error || "Unable to activate this eSIM right now.",
      });
      return;
    }

    const responseRow = response.success && response.data && typeof response.data === "object" ? response.data : {};
    const nextActivationUrl = resolveActivationLaunchUrl(esim, responseRow);

    if (!nextActivationUrl) {
      toast.error("Activation link is not available yet.");
      await refreshEsims(false, true);
      return;
    }

    markActivationPending([esim.orderReference, esim.iccid, esim.id, esim.activationCode]);
    markEsimPendingInUi(esim);
    toast.success("Opening activation");
    window.location.replace(nextActivationUrl);
  };

  const handleTopUp = async (esim: MyEsimItem) => {
    if (!esim.canTopUp) {
      return;
    }

    setBusyEsimId(esim.id);
    const response = await topUpEsim(
      esim.id,
      esim.topUpPlanId,
      {
        transactionId: undefined,
        esimTranNo: esim.transactionId || esim.orderReference || esim.id || "",
        iccid: esim.iccid || "",
      },
    );
    setBusyEsimId("");

    if (!response.success) {
      const details = resolveTopUpFailureDetails(response);
      if (isAuthFailureResponse(response)) {
        toast.error("Session expired, please login again");
        redirectToLoginAfterSessionExpiry();
        return;
      }

      if (details.requestId || details.traceId) {
        console.error("Top-up request failed", {
          requestId: details.requestId || undefined,
          traceId: details.traceId || undefined,
          response,
        });
      }

      toast.error("Top up failed", {
        description: details.message,
      });
      return;
    }

    toast.success("Top up completed");
    await refreshEsims(false, true);
  };

  return {
    esims,
    activeEsims,
    inactiveEsims,
    expiredEsims,
    loading,
    busyEsimId,
    selectedTab,
    selectedQrEsim,
    setSelectedTab,
    setSelectedQrEsim,
    refresh: async (force = false) => {
      await refreshEsims(false, force);
    },
    handleActivate,
    handleTopUp,
  };
}
