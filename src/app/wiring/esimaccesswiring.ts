import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { getCheckoutReturnUrl } from "../utils/native-payment";
import { getApiBaseCandidates, getFibBaseCandidates } from "./config";
import { resolveCountryName } from "./country-names";
import { requestApi } from "./http";
import { getCachedResource, invalidateCachedResource } from "./query-cache";
import { clearAuthSession, getAuthToken, getUserId, getUserName, getUserPhone } from "./session";
import type { ApiResponse, AnyRecord } from "./types";

export type MyEsimStatus = "active" | "inactive" | "expired";
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
  qrCodeUrl: string;
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
  resolveQrEsim: (esim: MyEsimItem) => Promise<MyEsimItem>;
  handleQrInstalled: (esim: MyEsimItem) => Promise<void>;
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
const USAGE_SYNC_TIMEOUT_MS = 4500;
const ESIMS_REFRESH_THROTTLE_MS = 25_000;
const ACTIVATION_PENDING_TTL_MS = 30 * 60 * 1000;
const MY_ESIMS_SHADOW_TTL_MS = 10 * 24 * 60 * 60 * 1000;
const POPULAR_DESTINATIONS_CACHE_KEY = "catalog.popular-destinations";
const ALL_DESTINATIONS_CACHE_KEY = "catalog.all-destinations";
const HOME_POPULAR_CONTENT_CACHE_KEY = "home.popular.content.v1";
const HOME_POPULAR_CODES_CACHE_KEY = "home.popular.codes.v1";
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const POPULAR_METRICS_CACHE_TTL_MS = 5 * 60 * 1000;
const PENDING_ORDER_STORAGE_KEY = "pendingOrderData";
const topUpSupportCache = new Map<string, TopUpSupport>();
const popularMetricsCache = new Map<string, { value: { priceFrom: number; plansCount: number }; expiresAt: number }>();

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

function toEpochMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 1e12 ? Math.floor(value) : value > 1e9 ? Math.floor(value * 1000) : 0;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return 0;
  }

  if (/^\d{13}$/.test(text)) {
    return Number(text);
  }

  if (/^\d{10}$/.test(text)) {
    return Number(text) * 1000;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readRowFreshnessMs(row: any): number {
  if (!row || typeof row !== "object") {
    return 0;
  }

  const raw = row?.raw && typeof row.raw === "object" ? row.raw : {};
  const customFields = row?.custom_fields || row?.customFields || {};
  const rawCustomFields = raw?.custom_fields || raw?.customFields || {};

  const candidates = [
    row?.updated_at,
    row?.updatedAt,
    row?.modified_at,
    row?.modifiedAt,
    row?.created_at,
    row?.createdAt,
    row?.activated_at,
    row?.activatedAt,
    row?.installed_at,
    row?.installedAt,
    row?.__shadowCreatedAt,
    raw?.updated_at,
    raw?.updatedAt,
    raw?.modified_at,
    raw?.modifiedAt,
    raw?.created_at,
    raw?.createdAt,
    raw?.activated_at,
    raw?.activatedAt,
    raw?.installed_at,
    raw?.installedAt,
    customFields?.updated_at,
    customFields?.updatedAt,
    customFields?.created_at,
    customFields?.createdAt,
    rawCustomFields?.updated_at,
    rawCustomFields?.updatedAt,
    rawCustomFields?.created_at,
    rawCustomFields?.createdAt,
  ];

  let max = 0;
  for (const candidate of candidates) {
    max = Math.max(max, toEpochMs(candidate));
  }
  return max;
}

function readRowInstallCompletenessScore(row: any): number {
  if (!row || typeof row !== "object") {
    return 0;
  }

  const raw = row?.raw && typeof row.raw === "object" ? row.raw : {};
  const customFields = {
    ...(row?.custom_fields && typeof row.custom_fields === "object" ? row.custom_fields : {}),
    ...(row?.customFields && typeof row.customFields === "object" ? row.customFields : {}),
    ...(raw?.custom_fields && typeof raw.custom_fields === "object" ? raw.custom_fields : {}),
    ...(raw?.customFields && typeof raw.customFields === "object" ? raw.customFields : {}),
  };

  const activationCode = String(
    row?.activation_code ||
      row?.activationCode ||
      raw?.activation_code ||
      raw?.activationCode ||
      customFields?.activation_code ||
      customFields?.activationCode ||
      row?.ac ||
      raw?.ac ||
      "",
  ).trim();
  const qrCodeUrl = String(
    row?.qr_code_url ||
      row?.qrCodeUrl ||
      raw?.qr_code_url ||
      raw?.qrCodeUrl ||
      customFields?.qr_code_url ||
      customFields?.qrCodeUrl ||
      "",
  ).trim();
  const installUrl = String(
    row?.install_url ||
      row?.installUrl ||
      row?.shortUrl ||
      row?.short_url ||
      raw?.install_url ||
      raw?.installUrl ||
      raw?.shortUrl ||
      raw?.short_url ||
      customFields?.install_url ||
      customFields?.installUrl ||
      customFields?.shortUrl ||
      customFields?.short_url ||
      "",
  ).trim();

  let score = 0;
  if (/^lpa:/i.test(activationCode)) {
    score += 5;
  } else if (activationCode) {
    score += 3;
  }
  if (qrCodeUrl) {
    score += 4;
  }
  if (installUrl) {
    score += 3;
  }
  if (String(row?.iccid || raw?.iccid || "").trim()) {
    score += 2;
  }
  if (toBoolean(row?.installed ?? raw?.installed ?? row?.installed_at ?? raw?.installed_at ?? row?.installedAt ?? raw?.installedAt)) {
    score += 1;
  }

  return score;
}

function readEsimInstallCompletenessScore(item: Partial<MyEsimItem> | null | undefined): number {
  if (!item) {
    return 0;
  }

  let score = 0;
  const activationCode = String(item.activationCode || "").trim();
  if (/^lpa:/i.test(activationCode)) {
    score += 5;
  } else if (activationCode) {
    score += 3;
  }
  if (String(item.qrCodeUrl || "").trim()) {
    score += 4;
  }
  if (String(item.installUrl || "").trim()) {
    score += 3;
  }
  if (String(item.qrPayload || "").trim()) {
    score += 2;
  }
  if (String(item.iccid || "").trim()) {
    score += 2;
  }
  if (item.isInstalled) {
    score += 1;
  }

  return score;
}

function getEsimLookupKeys(item: Partial<MyEsimItem>): string[] {
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

  add(item.id);
  add(item.orderReference);
  add(item.transactionId);
  add(item.iccid);
  add(item.activationCode);
  return keys;
}

function findBestMatchingEsim(items: MyEsimItem[], target: Partial<MyEsimItem>): MyEsimItem | null {
  const lookupKeys = getEsimLookupKeys(target);
  if (lookupKeys.length === 0) {
    return null;
  }

  let best: MyEsimItem | null = null;
  let bestScore = -1;

  items.forEach((candidate) => {
    const candidateKeys = getEsimLookupKeys(candidate);
    const isMatch = candidateKeys.some((key) => lookupKeys.includes(key));
    if (!isMatch) {
      return;
    }

    const score = readEsimInstallCompletenessScore(candidate);
    if (!best || score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
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

    const currentInstallScore = readRowInstallCompletenessScore(current);
    const nextInstallScore = readRowInstallCompletenessScore(row);
    if (nextInstallScore > currentInstallScore) {
      merged.set(key, row);
      return;
    }

    const currentFreshness = readRowFreshnessMs(current);
    const nextFreshness = readRowFreshnessMs(row);
    if (nextFreshness > currentFreshness) {
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

function toString(value: unknown): string {
  return String(value ?? "").trim();
}

function toUpper(value: unknown): string {
  return toString(value).toUpperCase();
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unwrapApiData<T = any>(response: ApiResponse<T>): any {
  const data = (response as any)?.data;
  if (data !== undefined) {
    if (data && typeof data === "object" && (data as AnyRecord).obj !== undefined) {
      return (data as AnyRecord).obj;
    }
    return data;
  }
  if ((response as any)?.obj !== undefined) {
    return (response as any).obj;
  }
  return null;
}

function requireUserId(): ApiResponse<never> | null {
  const token = toString(getAuthToken());
  const userId = toString(getUserId());
  if (!token || !userId) {
    return { success: false, error: "Session expired. Please login again.", statusCode: 401 };
  }
  return null;
}

function getCheckoutData(): AnyRecord {
  try {
    const raw = sessionStorage.getItem("checkoutData");
    return raw ? (JSON.parse(raw) as AnyRecord) : {};
  } catch {
    return {};
  }
}

function savePendingOrder(payload: AnyRecord): void {
  try {
    sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
}

function readPendingOrder(): AnyRecord | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function clearPendingOrder(): void {
  try {
    sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function pickRows(payload: any): any[] {
  const candidates = [
    payload,
    payload?.data,
    payload?.obj,
    payload?.result,
    payload?.payload,
    payload?.data?.data,
    payload?.data?.obj,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
    const rowCandidates = [
      candidate?.rows,
      candidate?.items,
      candidate?.list,
      candidate?.profiles,
      candidate?.orders,
      candidate?.locations,
      candidate?.locationList,
      candidate?.packageList,
    ];
    const rows = rowCandidates.find((entry) => Array.isArray(entry));
    if (Array.isArray(rows)) {
      return rows;
    }
  }

  return [];
}

function flattenLocations(rows: any[], bucket: any[] = []): any[] {
  (rows || []).forEach((item: any) => {
    if (!item || typeof item !== "object") {
      return;
    }
    bucket.push(item);
    const nested = Array.isArray(item?.subLocationList) ? item.subLocationList : [];
    if (nested.length > 0) {
      flattenLocations(nested, bucket);
    }
  });
  return bucket;
}

function pickPackageList(data: any): any[] {
  if (Array.isArray(data?.packageList)) {
    return data.packageList;
  }
  if (Array.isArray(data?.obj?.packageList)) {
    return data.obj.packageList;
  }
  return pickRows(data);
}

function normalizePriceUsd(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const text = toString(value).replace(/[$,\s]/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePlanPriceUsd(value: unknown, currencyCode: unknown): number {
  const parsed = normalizePriceUsd(value);
  if (parsed <= 0) {
    return 0;
  }

  // eSIM Access package catalog prices are returned in 1/10000 USD units (for example 3000 => 0.3 USD).
  const code = toUpper(currencyCode);
  if ((code === "USD" || !code) && Number.isInteger(parsed) && parsed >= 1000) {
    return parsed / 10000;
  }

  return parsed;
}

function pickFirstPositivePrice(values: unknown[]): number {
  for (const value of values) {
    const normalized = normalizePriceUsd(value);
    if (normalized > 0) {
      return normalized;
    }
  }
  return 0;
}

function normalizeDataGb(raw: unknown): number {
  const value = toNumber(raw, 0);
  if (value <= 0) {
    return 0;
  }
  if (value >= 1_000_000) {
    return value / (1024 * 1024 * 1024);
  }
  if (value > 100) {
    return value / 1024;
  }
  return value;
}

function normalizeValidityDays(row: any): number {
  const direct = toNumber(
    row?.durationDays ??
      row?.duration_days ??
      row?.validityDays ??
      row?.validity_days ??
      row?.validity ??
      row?.duration ??
      row?.periodNum,
    0,
  );

  if (direct > 0) {
    const unit = toUpper(row?.durationUnit ?? row?.duration_unit);
    if (unit === "HOUR" || unit === "HOURS") {
      return Math.max(1, Math.ceil(direct / 24));
    }
    if (unit === "WEEK" || unit === "WEEKS") {
      return Math.max(1, Math.round(direct * 7));
    }
    if (unit === "MONTH" || unit === "MONTHS") {
      return Math.max(1, Math.round(direct * 30));
    }
    return Math.max(1, Math.round(direct));
  }

  const tailMatch = toUpper(row?.slug || row?.packageCode).match(/_(\d{1,4})$/);
  return tailMatch ? Math.max(0, toInt(tailMatch[1], 0)) : 0;
}

function isPerDayOffer(row: any): boolean {
  const mode = toString(row?.allowanceMode ?? row?.allowance_mode).toLowerCase();
  if (mode === "per_day" || mode === "perday" || mode === "daily") {
    return true;
  }
  if (
    toBoolean(row?.isPerDay) ||
    toBoolean(row?.perDay) ||
    toBoolean(row?.daily) ||
    toBoolean(row?.dataPerDay) ||
    toBoolean(row?.is_daily)
  ) {
    return true;
  }
  const source = [
    row?.slug,
    row?.name,
    row?.description,
    row?.allowanceMode,
    row?.allowance_mode,
  ]
    .map((value) => toString(value).toLowerCase())
    .filter(Boolean)
    .join(" ");
  return /(^|[\s/_-])(daily|perday|per day|day pass|daypass|\/day)([\s/_-]|$)/.test(source);
}

function normalizeDestination(item: any, index: number): AnyRecord {
  const code = toUpper(item?.code || item?.iso || item?.country_code || item?.locationCode);
  const name = toString(item?.name || item?.country_name || resolveCountryName(code) || code || "Unknown");
  const priceFrom = toNumber(item?.priceFrom ?? item?.price_from ?? item?.min_price ?? 0, 0);
  const plansCount = toInt(item?.plansCount ?? item?.plans ?? 0, 0);
  const type = toString(item?.type || item?.locationType || (code.length === 2 ? "country" : "regional")).toLowerCase();

  return {
    id: item?.id ?? code ?? index + 1,
    name,
    flag: resolveDisplayFlag(item?.flag || item?.emoji, code),
    priceFrom,
    price_from: priceFrom,
    code,
    iso: code,
    plansCount,
    plans: plansCount,
    type,
  };
}

function normalizePopularDestination(item: any, index: number): AnyRecord {
  if (typeof item === "string") {
    const code = toUpper(item);
    return {
      id: code || index + 1,
      name: resolveCountryName(code) || code || "Unknown",
      flag: flagFromIso(code),
      priceFrom: 0,
      price_from: 0,
      code,
      iso: code,
      plansCount: 0,
      plans: 0,
      type: "country",
    };
  }

  const normalized = normalizeDestination(item, index);
  const code = toUpper(normalized.code || normalized.iso);
  return {
    ...normalized,
    code,
    iso: code,
    name: toString(normalized.name) || resolveCountryName(code) || code || "Unknown",
    flag: resolveDisplayFlag(normalized.flag, code),
  };
}

function normalizePlan(row: any, index: number): AnyRecord {
  const id = row?.packageCode || row?.id || row?.bundleName || row?.bundle_name || row?.slug || `plan-${index + 1}`;
  const data = normalizeDataGb(row?.data ?? row?.dataGB ?? row?.data_gb ?? row?.volume ?? row?.totalVolume);
  const validity = normalizeValidityDays(row);
  const price = [
    row?.price,
    row?.retailPrice,
    row?.salePrice,
  ]
    .map((candidate) => normalizePlanPriceUsd(candidate, row?.currencyCode ?? row?.currency_code))
    .find((candidate) => candidate > 0) || 0;
  const allowanceMode = isPerDayOffer(row) ? "per_day" : toString(row?.allowanceMode ?? row?.allowance_mode);

  return {
    ...row,
    id,
    bundleName: row?.packageCode || row?.bundleName || id,
    name: row?.name || row?.packageName || row?.slug || "Plan",
    data,
    dataGB: data,
    validity,
    price,
    currencyCode: row?.currencyCode || row?.currency_code || "USD",
    speed: row?.speed || "",
    location: row?.location || "",
    locationCode: row?.locationCode || row?.location_code || "",
    locationNetworkList: Array.isArray(row?.locationNetworkList) ? row.locationNetworkList : [],
    durationUnit: row?.durationUnit || row?.duration_unit || "",
    description: row?.description || "",
    allowanceMode,
    allowance_mode: allowanceMode,
    unlimited: toBoolean(row?.unlimited),
    coverageCountries: row?.coverageCountries || row?.coverage_countries || [],
  };
}

function compareFeaturedRows(a: any, b: any): number {
  const aUpdated = parseDateToMs(a?.updatedAt ?? a?.updated_at);
  const bUpdated = parseDateToMs(b?.updatedAt ?? b?.updated_at);
  if (aUpdated !== bUpdated) {
    return bUpdated - aUpdated;
  }
  const aCreated = parseDateToMs(a?.createdAt ?? a?.created_at);
  const bCreated = parseDateToMs(b?.createdAt ?? b?.created_at);
  if (aCreated !== bCreated) {
    return bCreated - aCreated;
  }
  return toNumber(b?.id, 0) - toNumber(a?.id, 0);
}

function getLatestFeaturedRows(rows: any[]): any[] {
  const latestByCode = new Map<string, any>();
  for (const row of rows || []) {
    const code = toUpper(row?.code);
    if (!code) {
      continue;
    }
    const current = latestByCode.get(code);
    if (!current || compareFeaturedRows(row, current) < 0) {
      latestByCode.set(code, row);
    }
  }
  return Array.from(latestByCode.values());
}

async function fetchPopularLocationMetrics(code: string): Promise<{ priceFrom: number; plansCount: number }> {
  const normalizedCode = toUpper(code);
  if (!normalizedCode) {
    return { priceFrom: 0, plansCount: 0 };
  }

  const cached = popularMetricsCache.get(normalizedCode);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const response = await requestApi("/esim-access/packages/query", {
    method: "POST",
    body: { locationCode: normalizedCode },
    includeAuth: false,
  });

  if (!response.success) {
    const fallback = { priceFrom: 0, plansCount: 0 };
    popularMetricsCache.set(normalizedCode, { value: fallback, expiresAt: now + POPULAR_METRICS_CACHE_TTL_MS });
    return fallback;
  }

  const rows = pickPackageList(unwrapApiData(response) || response);
  const nonDailyOffers = rows.filter((row) => !isPerDayOffer(row));
  const pricedOffers = nonDailyOffers
    .map((row) =>
      [
        row?.price,
        row?.retailPrice,
        row?.salePrice,
      ]
        .map((candidate) => normalizePlanPriceUsd(candidate, row?.currencyCode ?? row?.currency_code))
        .find((candidate) => candidate > 0) || 0,
    )
    .filter((value) => value > 0);
  const metrics = {
    priceFrom: pricedOffers.length > 0 ? Math.min(...pricedOffers) : 0,
    plansCount: nonDailyOffers.length,
  };
  popularMetricsCache.set(normalizedCode, { value: metrics, expiresAt: now + POPULAR_METRICS_CACHE_TTL_MS });
  return metrics;
}

export async function getAllDestinations(): Promise<ApiResponse<any[]>> {
  return getCachedResource(
    ALL_DESTINATIONS_CACHE_KEY,
    CATALOG_CACHE_TTL_MS,
    async () => {
      const response = await requestApi("/esim-access/locations/query", {
        method: "POST",
        body: {},
        includeAuth: false,
      });
      if (!response.success) {
        return response as ApiResponse<any[]>;
      }

      const data = unwrapApiData(response);
      const rows = flattenLocations(Array.isArray(data?.locationList) ? data.locationList : pickRows(data));
      const byCode = new Map<string, AnyRecord>();
      rows.map(normalizeDestination).forEach((row) => {
        const code = toUpper(row?.code);
        if (code && !byCode.has(code)) {
          byCode.set(code, row);
        }
      });

      return { success: true, data: Array.from(byCode.values()) };
    },
    { shouldCache: (response) => Boolean(response.success) },
  );
}

export async function getPopularDestinations(): Promise<ApiResponse<any[]>> {
  return getCachedResource(
    POPULAR_DESTINATIONS_CACHE_KEY,
    CATALOG_CACHE_TTL_MS,
    async () => {
      const candidates = [
        "/esim-access/featured-locations",
        "/featured-locations/public",
        "/admin/featured-locations",
      ];

      let featured: ApiResponse | null = null;
      for (const path of candidates) {
        const response = await requestApi(path, { includeAuth: path === "/admin/featured-locations" });
        featured = response;
        if (response.success) {
          break;
        }
      }

      if (!featured?.success) {
        return featured as ApiResponse<any[]>;
      }

      const data = unwrapApiData(featured) || featured;
      const rows = pickRows(data);
      const activePopularRows = getLatestFeaturedRows(rows).filter((row: any) => {
        const isPopular = toBoolean(row?.isPopular ?? row?.is_popular ?? true);
        const enabled = toBoolean(row?.enabled ?? true);
        return isPopular && enabled;
      });
      const rowsWithMetrics = await Promise.all(
        activePopularRows.map(async (row: any, index: number) => {
          const normalized = normalizePopularDestination(row, index);
          const code = toUpper(normalized.code);
          const metrics = await fetchPopularLocationMetrics(code);
          return { normalized, code, metrics };
        }),
      );

      return {
        success: true,
        data: rowsWithMetrics
          .filter(({ code, metrics }) => code.length === 2 && metrics.priceFrom > 0 && metrics.plansCount > 1)
          .map(({ normalized, metrics }) => ({
            ...normalized,
            priceFrom: metrics.priceFrom,
            price_from: metrics.priceFrom,
            plansCount: metrics.plansCount,
            plans: metrics.plansCount,
            status: normalized.status || "active",
          })),
      };
    },
    { shouldCache: (response) => Boolean(response.success) },
  );
}

export async function getAdminPopularDestinations(): Promise<ApiResponse<string[]>> {
  const response = await requestApi("/admin/featured-locations");
  if (!response.success) {
    return response as ApiResponse<string[]>;
  }

  const data = unwrapApiData(response) || response;
  const rows = pickRows(data);
  const codes = getLatestFeaturedRows(rows)
    .filter((row: any) => {
      const isPopular = toBoolean(row?.isPopular ?? row?.is_popular ?? true);
      const enabled = toBoolean(row?.enabled ?? true);
      return isPopular && enabled;
    })
    .map((row: any) => toUpper(row?.code || row?.iso || row?.country_code))
    .filter(Boolean);

  return { success: true, data: Array.from(new Set(codes)) };
}

export async function setAdminPopularDestinations(countryCodes: string[]): Promise<ApiResponse<any>> {
  const normalized = countryCodes
    .map((code) => toUpper(code))
    .filter((code) => code.length === 2);

  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized[index];
    const response = await requestApi("/admin/featured-locations", {
      method: "POST",
      body: {
        code,
        name: resolveCountryName(code) || code,
        serviceType: "esim",
        locationType: "country",
        isPopular: true,
        enabled: true,
        sortOrder: index + 1,
      },
    });
    if (!response.success) {
      return response;
    }
  }

  invalidateCachedResource(POPULAR_DESTINATIONS_CACHE_KEY);
  try {
    localStorage.setItem(HOME_POPULAR_CODES_CACHE_KEY, JSON.stringify(normalized));
    localStorage.removeItem(HOME_POPULAR_CONTENT_CACHE_KEY);
  } catch {
    // Ignore storage failures.
  }

  return { success: true, data: { message: "Popular destinations updated", codes: normalized } };
}

export async function clearAdminPopularDestinations(): Promise<ApiResponse<any>> {
  const response = await requestApi("/admin/featured-locations");
  if (!response.success) {
    return response;
  }

  const data = unwrapApiData(response) || response;
  const activePopularRows = getLatestFeaturedRows(pickRows(data)).filter((row: any) => {
    const isPopular = toBoolean(row?.isPopular ?? row?.is_popular ?? true);
    const enabled = toBoolean(row?.enabled ?? true);
    return isPopular && enabled;
  });

  for (const row of activePopularRows) {
    const code = toUpper(row?.code);
    if (!code) {
      continue;
    }
    const clearResponse = await requestApi("/admin/featured-locations", {
      method: "POST",
      body: {
        code,
        name: toString(row?.name || resolveCountryName(code) || code),
        serviceType: toString(row?.serviceType ?? row?.service_type ?? "esim"),
        locationType: toString(row?.locationType ?? row?.location_type ?? "country"),
        badgeText: row?.badgeText ?? row?.badge_text ?? null,
        sortOrder: toNumber(row?.sortOrder ?? row?.sort_order, 0),
        isPopular: false,
        enabled: false,
        startsAt: row?.startsAt ?? row?.starts_at ?? null,
        endsAt: row?.endsAt ?? row?.ends_at ?? null,
        customFields: row?.customFields ?? row?.custom_fields ?? {},
      },
    });
    if (!clearResponse.success) {
      return clearResponse;
    }
  }

  invalidateCachedResource(POPULAR_DESTINATIONS_CACHE_KEY);
  try {
    localStorage.setItem(HOME_POPULAR_CODES_CACHE_KEY, JSON.stringify([]));
    localStorage.removeItem(HOME_POPULAR_CONTENT_CACHE_KEY);
  } catch {
    // Ignore storage failures.
  }

  return { success: true, data: { message: "Popular destinations cleared", cleared: activePopularRows.length } };
}

export async function getCountryPlans(countryCode: string): Promise<ApiResponse<any[]>> {
  const response = await requestApi("/esim-access/packages/query", {
    method: "POST",
    body: { locationCode: toUpper(countryCode) },
    includeAuth: false,
  });
  if (!response.success) {
    return response as ApiResponse<any[]>;
  }
  const rows = pickPackageList(unwrapApiData(response) || response);
  return { success: true, data: rows.map(normalizePlan) };
}

export async function getRegionPlans(regionCode: string): Promise<ApiResponse<any[]>> {
  return getCountryPlans(regionCode);
}

async function resolveCurrencySettingsForCheckout(): Promise<{ exchangeRate: string; markupPercent: string }> {
  const fallback = { exchangeRate: "1320", markupPercent: "0" };
  const paths = ["/esim-access/exchange-rates/current", "/admin/exchange-rates"];
  for (const path of paths) {
    const response = await requestApi(path, { includeAuth: path.startsWith("/admin/") });
    if (!response.success) {
      continue;
    }
    const data = unwrapApiData(response) || response.data || {};
    const rows = pickRows(data);
    const preferred = rows.find((row) => {
      const pair = toUpper(row?.pair || row?.currencyPair || row?.currency_pair || row?.symbol || row?.code);
      const base = toUpper(row?.baseCurrency || row?.base_currency || row?.fromCurrency || row?.from_currency);
      const quote = toUpper(row?.quoteCurrency || row?.quote_currency || row?.toCurrency || row?.to_currency);
      return pair.includes("USD") && pair.includes("IQD") || (base === "USD" && quote === "IQD");
    }) || rows[0] || data;
    const exchangeRate = pickFirstPositivePrice([
      preferred?.exchangeRate,
      preferred?.exchange_rate,
      preferred?.rate,
      preferred?.usdToIqd,
      preferred?.usd_to_iqd,
      data?.exchangeRate,
      data?.exchange_rate,
      data?.rate,
    ]);
    const markupPercent = toNumber(
      preferred?.markupPercent ??
        preferred?.markup_percent ??
        preferred?.markup ??
        data?.markupPercent ??
        data?.markup_percent ??
        data?.markup,
      0,
    );
    if (exchangeRate > 0) {
      return { exchangeRate: String(exchangeRate), markupPercent: String(markupPercent) };
    }
  }
  return fallback;
}

function convertUsdToIqd(usdPrice: number, exchangeRate: string, markupPercent: string): number {
  const rate = toNumber(exchangeRate, 1320);
  const markup = toNumber(markupPercent, 0);
  const withMarkup = usdPrice * (1 + markup / 100);
  return Math.max(0, Math.round(withMarkup * rate));
}

function buildPurchasePayload(planId: string, autoTopUp = false): AnyRecord {
  const checkout = getCheckoutData();
  const country = checkout?.country || {};
  const plan = checkout?.plan || {};
  const userId = getUserId();

  return {
    userId,
    planId,
    bundleName: planId,
    autoTopUp,
    country: {
      name: country?.name || "",
      flag: country?.flag || "",
      code: country?.code || "",
    },
    plan: {
      id: planId,
      data: toNumber(plan?.data, 0),
      validity: toInt(plan?.validity, 0),
      price: toNumber(plan?.price, 0),
      slug: plan?.slug || "",
      name: plan?.name || "",
    },
  };
}

function createPurchaseTransactionId(prefix = "ORDER"): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function normalizePaymentPayload(raw: any): AnyRecord {
  const payload = raw && typeof raw === "object" && raw.data ? raw.data : raw;
  const links = payload?.links || {};
  const paymentId = payload?.paymentId || payload?.payment_id || payload?.reference || payload?.readable_code || "";

  return {
    paymentLink:
      payload?.paymentLink ||
      payload?.payment_link ||
      payload?.paymentUrl ||
      payload?.payment_url ||
      payload?.personalAppLink ||
      links?.personal ||
      links?.business ||
      links?.corporate ||
      "",
    qrCodeUrl: payload?.qrCodeUrl || payload?.qr_url || payload?.qrCode || payload?.qr || "",
    paymentId,
    reference: payload?.reference || payload?.readable_code || paymentId,
    raw: payload,
  };
}

async function createFibPayment(payload: {
  amount: number;
  description: string;
  returnUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
  redirectUrl?: string;
  callbackUrl?: string;
  metadata?: AnyRecord;
}): Promise<ApiResponse> {
  const paths = [
    "/payments/fib/checkout",
    "/payments/fib/create",
    "/payments/fib/intent",
    "/payments/fib/initiate",
  ];
  let lastError = "FIB payment is not available in backendformobileapp yet.";

  for (const path of paths) {
    const response = await requestApi(path, {
      method: "POST",
      body: {
        amount: Math.max(0, Math.round(toNumber(payload.amount, 0))),
        currency: "IQD",
        description: toString(payload.description || "Tulip eSIM purchase"),
        returnUrl: toString(payload.returnUrl),
        successUrl: toString(payload.successUrl),
        cancelUrl: toString(payload.cancelUrl),
        redirectUrl: toString(payload.redirectUrl),
        callbackUrl: toString(payload.callbackUrl),
        metadata: payload.metadata || {},
        platformCode: "tulip_mobile_app",
        platformName: "Tulip Mobile App",
      },
      includeAuth: true,
    });

    if (response.success) {
      return response;
    }

    const errorText = toString(response.error);
    if (errorText) {
      lastError = errorText;
    }
    const lower = errorText.toLowerCase();
    const looksMissingRoute =
      lower.includes("not found") ||
      lower.includes("method not allowed") ||
      lower.includes("status 404") ||
      lower.includes("status 405");
    if (!looksMissingRoute) {
      return response;
    }
  }

  return { success: false, error: lastError || "Unable to create FIB payment." };
}

export async function purchaseWithFIB(planId: string, autoTopUp = false): Promise<ApiResponse<any>> {
  const authError = requireUserId();
  if (authError) {
    return authError;
  }

  const payload = buildPurchasePayload(planId, autoTopUp);
  const checkout = getCheckoutData();
  const usdPrice = toNumber(checkout?.plan?.price, 0);
  const settings = await resolveCurrencySettingsForCheckout();
  const amount = convertUsdToIqd(usdPrice, settings.exchangeRate, settings.markupPercent);
  if (amount <= 0) {
    return { success: false, error: "Plan price is not configured for checkout." };
  }

  const transactionId = createPurchaseTransactionId("FIB");
  const purchasePayload = {
    ...payload,
    transactionId,
    amountIqd: amount,
    providerPriceUsd: usdPrice,
    exchangeRate: toNumber(settings.exchangeRate, 0),
    markupPercent: toNumber(settings.markupPercent, 0),
    paymentMethod: "fib",
  };
  savePendingOrder(purchasePayload);

  const successUrl = getCheckoutReturnUrl("success");
  const cancelUrl = getCheckoutReturnUrl("cancelled");
  const response = await createFibPayment({
    amount,
    description: `eSIM ${toString(checkout?.country?.name || "Plan")} ${toString(checkout?.plan?.data || "")}GB`,
    returnUrl: successUrl,
    successUrl,
    cancelUrl,
    redirectUrl: successUrl,
    callbackUrl: successUrl,
    metadata: {
      transactionId,
      planId,
      customerUserId: payload.userId,
      countryCode: payload?.country?.code || "",
      autoTopUp: Boolean(autoTopUp),
    },
  });

  if (!response.success) {
    clearPendingOrder();
    return { success: false, error: response.error || "Unable to create FIB payment" };
  }

  const normalized = normalizePaymentPayload(response.data);
  return {
    success: true,
    data: {
      ...normalized,
      amount,
      currency: "IQD",
    },
  };
}

async function completeManagedPurchase(payload: AnyRecord): Promise<ApiResponse<any>> {
  const packageCode = toString(payload?.planId || payload?.bundleName || payload?.packageCode);
  const transactionId = toString(payload?.transactionId);
  if (!packageCode) {
    return { success: false, error: "Missing plan package code." };
  }
  if (!transactionId) {
    return { success: false, error: "Missing transaction id." };
  }

  const meResponse = await requestApi("/auth/me");
  if (!meResponse.success) {
    return { success: false, error: meResponse.error || "Unable to read current user session." };
  }
  const me = unwrapApiData(meResponse) || {};
  const userPhone = toString(me?.phone || getUserPhone());
  if (!userPhone) {
    return { success: false, error: "Missing user phone for managed booking." };
  }

  const paymentMethod = toString(payload?.paymentMethod || "unknown").toLowerCase();
  const amountIqd = Math.max(0, Math.round(toNumber(payload?.amountIqd ?? payload?.amount ?? payload?.salePriceMinor, 0)));
  const countryCode = toUpper(payload?.country?.code || payload?.countryCode);
  const countryName = toString(payload?.country?.name || payload?.countryName);
  const packageSlug = toString(payload?.plan?.slug || payload?.packageSlug);
  const packageName = toString(payload?.plan?.name || payload?.packageName || payload?.country?.name || "eSIM Package");

  const orderResponse = await requestApi("/esim-access/orders/managed", {
    method: "POST",
    body: {
      providerRequest: {
        transactionId,
        packageInfoList: [{ packageCode, count: 1 }],
      },
      user: {
        phone: userPhone,
        name: toString(me?.name || getUserName() || "User"),
        email: toString(me?.email) || undefined,
        status: "active",
        isLoyalty: Boolean(paymentMethod === "loyalty" || me?.isLoyalty),
      },
      platformCode: "tulip_mobile_app",
      platformName: "Tulip Mobile App",
      currencyCode: "IQD",
      providerCurrencyCode: "IQD",
      exchangeRate: 1,
      salePriceMinor: amountIqd > 0 ? amountIqd : undefined,
      providerPriceMinor: amountIqd > 0 ? amountIqd : undefined,
      countryCode: countryCode || undefined,
      countryName: countryName || undefined,
      packageCode,
      packageSlug: packageSlug || undefined,
      packageName: packageName || undefined,
      customFields: {
        ...(payload?.customFields && typeof payload.customFields === "object" ? payload.customFields : {}),
        paymentMethod,
        paymentStatus: toString(payload?.paymentStatus || "completed"),
        autoTopUp: Boolean(payload?.autoTopUp),
        checkoutSnapshot: payload?.plan && payload?.country
          ? { plan: payload.plan, country: payload.country }
          : undefined,
      },
    },
    includeAuth: true,
  });

  if (!orderResponse.success) {
    return orderResponse;
  }

  const orderData = unwrapApiData(orderResponse) || orderResponse.data || {};
  const providerOrderNo = toString(
    orderData?.database?.providerOrderNo ||
      orderData?.provider?.obj?.orderNo ||
      orderData?.providerOrderNo ||
      orderData?.provider_order_no ||
      orderData?.orderNo ||
      orderData?.order_no ||
      orderData?.obj?.orderNo ||
      orderData?.obj?.order_no,
  );

  let syncResult: ApiResponse | null = null;
  if (providerOrderNo) {
    syncResult = await requestApi("/esim-access/profiles/sync", {
      method: "POST",
      body: {
        providerRequest: { orderNo: providerOrderNo },
        platformCode: "tulip_mobile_app",
        platformName: "Tulip Mobile App",
        actorPhone: userPhone,
      },
      includeAuth: true,
    });
  }

  const data = {
    order: orderData,
    sync: syncResult?.success ? (unwrapApiData(syncResult) || syncResult.data || null) : null,
  };
  saveMyEsimShadowFromPurchaseResult(data, {
    country: payload?.country,
    plan: payload?.plan,
  });
  return { success: true, data };
}

export async function purchaseWithLoyalty(planId: string, autoTopUp = false): Promise<ApiResponse<any>> {
  const authError = requireUserId();
  if (authError) {
    return authError;
  }

  const loyaltyStatus = await getLoyaltyStatus();
  if (!loyaltyStatus.success) {
    return loyaltyStatus;
  }
  if (!Boolean(loyaltyStatus.data?.hasAccess)) {
    return { success: false, error: "Loyalty is not enabled for this account." };
  }

  const payload = buildPurchasePayload(planId, autoTopUp);
  const checkout = getCheckoutData();
  const usdPrice = toNumber(checkout?.plan?.price, 0);
  const settings = await resolveCurrencySettingsForCheckout();
  const amount = convertUsdToIqd(usdPrice, settings.exchangeRate, settings.markupPercent);
  if (amount <= 0) {
    return { success: false, error: "Plan price is not configured for checkout." };
  }

  return completeManagedPurchase({
    ...payload,
    transactionId: createPurchaseTransactionId("LOYALTY"),
    amountIqd: amount,
    providerPriceUsd: usdPrice,
    exchangeRate: toNumber(settings.exchangeRate, 0),
    markupPercent: toNumber(settings.markupPercent, 0),
    paymentMethod: "loyalty",
    paymentStatus: "approved",
  });
}

export async function completePendingPurchase(paymentMeta?: AnyRecord): Promise<ApiResponse<any>> {
  const authError = requireUserId();
  if (authError) {
    return authError;
  }

  const pending = readPendingOrder();
  if (!pending) {
    return { success: true, data: { skipped: true, reason: "No pending payment found." } };
  }

  const response = await completeManagedPurchase({ ...pending, ...(paymentMeta || {}) });
  if (response.success) {
    clearPendingOrder();
  }
  return response;
}

export async function getLoyaltyStatus(): Promise<ApiResponse<{ hasAccess: boolean }>> {
  const response = await requestApi("/auth/me");
  if (!response.success) {
    return response as ApiResponse<{ hasAccess: boolean }>;
  }
  const data = unwrapApiData(response) || response.data || {};
  return {
    success: true,
    data: {
      hasAccess: Boolean(data?.isLoyalty),
    },
  };
}

function extractProfileRowsFromPayload(payload: any): any[] {
  const roots = [payload, payload?.data, payload?.obj, payload?.result, payload?.payload, payload?.data?.data];
  const rows: any[] = [];
  roots.forEach((root) => {
    pickRows(root).forEach((row) => rows.push(row));
  });
  if (Array.isArray(payload)) {
    rows.push(...payload);
  }
  return mergeRowsByIdentity([], rows);
}

function normalizeVolumeToMb(value: unknown): number {
  const numeric = extractNumber(value, Number.NaN);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  // Provider volume-like fields may arrive as bytes, KB, or MB.
  if (numeric >= 1024 * 1024) {
    return Math.max(0, Math.round(numeric / (1024 * 1024)));
  }
  if (numeric >= 10 * 1024) {
    return Math.max(0, Math.round(numeric / 1024));
  }
  return Math.max(0, Math.round(numeric));
}

function normalizeUsageMb(row: any, customFields: AnyRecord): { totalMb: number; usedMb: number; remainingMb: number } {
  const totalMb = Math.max(
    0,
    extractNumber(
      row?.dataTotalMb ??
        row?.totalDataMb ??
        row?.total_data_mb ??
        row?.totalData ??
        row?.total_data ??
        row?.packageDataMb ??
        row?.package_data_mb ??
        row?.dataTotal ??
        row?.totalVolumeMb ??
        row?.total_volume_mb ??
        customFields?.packageDataMb ??
        customFields?.totalDataMb ??
        customFields?.total_data_mb ??
        customFields?.totalData ??
        customFields?.total_data,
      Number.NaN,
    ),
  );
  const totalVolumeMb = normalizeVolumeToMb(
    row?.totalVolume ??
      row?.total_volume ??
      row?.totalVolumeBytes ??
      row?.total_volume_bytes ??
      customFields?.totalVolume ??
      customFields?.total_volume ??
      customFields?.totalVolumeBytes ??
      customFields?.total_volume_bytes,
  );
  const usedMb = Math.max(
    0,
    extractNumber(
      row?.dataUsedMb ??
        row?.usedData ??
        row?.used_data ??
        row?.usedDataMb ??
        row?.used_data_mb ??
        row?.dataUsed ??
        row?.orderUsageMb ??
        row?.order_usage_mb ??
        row?.usedVolume ??
        row?.used_volume ??
        row?.orderUsage ??
        row?.order_usage ??
        customFields?.usedDataMb ??
        customFields?.used_data_mb ??
        customFields?.dataUsedMb ??
        customFields?.data_used_mb ??
        customFields?.orderUsageMb ??
        customFields?.order_usage_mb ??
        customFields?.orderUsage ??
        customFields?.order_usage,
      0,
    ),
  );
  const usedFromVolumeMb = normalizeVolumeToMb(
    row?.usedVolume ??
      row?.used_volume ??
      row?.orderUsage ??
      row?.order_usage ??
      row?.orderUsageBytes ??
      row?.order_usage_bytes ??
      customFields?.usedVolume ??
      customFields?.used_volume ??
      customFields?.orderUsage ??
      customFields?.order_usage,
  );
  const providedRemaining = extractNumber(
    row?.dataRemainingMb ??
      row?.remainingDataMb ??
      row?.remaining_data_mb ??
      row?.remainingData ??
      row?.remaining_data ??
      customFields?.dataRemainingMb ??
      customFields?.remainingDataMb ??
      customFields?.remaining_data_mb ??
      customFields?.remainingData ??
      customFields?.remaining_data,
    Number.NaN,
  );
  const remainingFromVolumeMb = normalizeVolumeToMb(
    row?.remainingVolume ??
      row?.remaining_volume ??
      row?.orderBalance ??
      row?.order_balance ??
      customFields?.remainingVolume ??
      customFields?.remaining_volume ??
      customFields?.orderBalance ??
      customFields?.order_balance,
  );

  const initialTotal = Number.isFinite(totalMb) && totalMb > 0 ? totalMb : totalVolumeMb;
  let resolvedRemaining = Number.isFinite(providedRemaining)
    ? Math.max(0, providedRemaining)
    : remainingFromVolumeMb > 0
    ? remainingFromVolumeMb
    : Number.NaN;
  let resolvedUsed = usedFromVolumeMb > 0 ? usedFromVolumeMb : usedMb;
  let resolvedTotal = initialTotal;

  if (resolvedTotal <= 0 && Number.isFinite(resolvedRemaining)) {
    resolvedTotal = Math.max(0, resolvedUsed + resolvedRemaining);
  }

  if (resolvedTotal > 0 && Number.isFinite(resolvedRemaining)) {
    const usedFromRemaining = Math.max(0, resolvedTotal - resolvedRemaining);
    if (resolvedUsed <= 0 || Math.abs((resolvedTotal - resolvedUsed) - resolvedRemaining) > 5) {
      resolvedUsed = usedFromRemaining;
    }
  }

  if (!Number.isFinite(resolvedRemaining)) {
    resolvedRemaining = resolvedTotal > 0 ? Math.max(0, resolvedTotal - resolvedUsed) : 0;
  }

  if (resolvedTotal > 0) {
    resolvedUsed = Math.min(Math.max(0, resolvedUsed), resolvedTotal);
    resolvedRemaining = Math.min(Math.max(0, resolvedRemaining), resolvedTotal);
  } else {
    resolvedUsed = Math.max(0, resolvedUsed);
    resolvedRemaining = Math.max(0, resolvedRemaining);
  }

  if (resolvedTotal <= 0 && (resolvedUsed > 0 || resolvedRemaining > 0)) {
    resolvedTotal = resolvedUsed + resolvedRemaining;
  }

  return {
    totalMb: Math.max(0, Math.round(resolvedTotal)),
    usedMb: Math.max(0, Math.round(resolvedUsed)),
    remainingMb: Math.max(0, Math.round(resolvedRemaining)),
  };
}

function normalizeProfileRowForPage(row: any): AnyRecord {
  const raw = row && typeof row === "object" ? row : {};
  const customFields = {
    ...parseObjectCandidate(raw?.custom_fields),
    ...parseObjectCandidate(raw?.customFields),
  };
  const checkoutSnapshot = parseObjectCandidate(
    customFields?.checkoutSnapshot ||
      customFields?.checkout_snapshot ||
      raw?.checkoutSnapshot ||
      raw?.checkout_snapshot ||
      raw?.purchaseSnapshot ||
      raw?.purchase_snapshot,
  );
  const snapshotCountry = parseObjectCandidate(checkoutSnapshot?.country);
  const snapshotPlan = parseObjectCandidate(checkoutSnapshot?.plan);
  const usage = normalizeUsageMb(raw, customFields);
  const countryCode = toUpper(
    snapshotCountry?.code ||
      checkoutSnapshot?.countryCode ||
      customFields?.countryCode ||
      customFields?.country_code ||
      raw?.country_code ||
      raw?.countryCode,
  );
  const countryName = toString(
    snapshotCountry?.name ||
      checkoutSnapshot?.countryName ||
      customFields?.countryName ||
      customFields?.country_name ||
      customFields?.country ||
      raw?.country_name ||
      raw?.countryName ||
      resolveCountryName(countryCode) ||
      countryCode ||
      "Unknown",
  );
  const planName = toString(
    snapshotPlan?.name ||
      checkoutSnapshot?.packageName ||
      customFields?.packageName ||
      customFields?.package_name ||
      raw?.name ||
      countryName ||
      "Travel Plan",
  );
  const installed = toBoolean(raw?.installed ?? raw?.isInstalled ?? raw?.installed_at ?? raw?.installedAt);
  const activatedAt = toString(raw?.activated_at || raw?.activatedAt || customFields?.activatedAt || customFields?.activated_at);
  const rawStatus = toString(
    raw?.status ||
      raw?.app_status ||
      raw?.provider_status ||
      raw?.esimStatus ||
      raw?.esim_status ||
      customFields?.shadowStatus ||
      "inactive",
  ).toLowerCase();
  const status: MyEsimStatus =
    hasTerminalSignals(rawStatus)
      ? "expired"
      : rawStatus === "active" && installed && Boolean(activatedAt)
      ? "active"
      : "inactive";
  const providerOrderNo = toString(
    raw?.provider_order_no ||
      raw?.providerOrderNo ||
      customFields?.providerOrderNo ||
      customFields?.provider_order_no ||
      customFields?.orderNo ||
      customFields?.order_no,
  );
  const esimTranNo = toString(raw?.esim_tran_no || raw?.esimTranNo);
  const activationCode = toString(
    raw?.activation_code ||
      raw?.activationCode ||
      customFields?.activationCode ||
      customFields?.activation_code ||
      raw?.ac,
  );
  const qrCodeUrl = toString(raw?.qr_code_url || raw?.qrCodeUrl || customFields?.qrCodeUrl || customFields?.qr_code_url);
  const installUrl = toString(
    raw?.install_url ||
      raw?.installUrl ||
      raw?.shortUrl ||
      raw?.short_url ||
      customFields?.installUrl ||
      customFields?.install_url ||
      customFields?.shortUrl ||
      customFields?.short_url,
  );

  return {
    ...raw,
    id: toString(raw?.id || raw?.iccid || esimTranNo || providerOrderNo),
    userId: toString(raw?.user_id || raw?.userId || getUserId()),
    providerOrderNo,
    provider_order_no: providerOrderNo,
    esimTranNo,
    esim_tran_no: esimTranNo,
    name: planName,
    country: countryName,
    countryName,
    countryCode,
    country_code: countryCode,
    flag: resolveDisplayFlag(raw?.flag, countryCode),
    status,
    dataUsedMb: usage.usedMb,
    dataTotalMb: usage.totalMb,
    dataRemainingMb: usage.remainingMb,
    dataUsed: usage.usedMb,
    dataTotal: usage.totalMb,
    dataRemaining: usage.remainingMb,
    daysLeft: raw?.daysLeft ?? raw?.days_left ?? customFields?.daysLeft ?? customFields?.days_left,
    validityDays: normalizeValidityDays({ ...raw, ...customFields, ...snapshotPlan }),
    installed,
    activatedAt,
    activated_at: activatedAt,
    bundleExpiresAt: toString(raw?.bundleExpiresAt || raw?.bundle_expires_at || raw?.expiresAt || raw?.expires_at),
    activationCode,
    activation_code: activationCode,
    qrCodeUrl,
    qr_code_url: qrCodeUrl,
    installUrl,
    install_url: installUrl,
    iccid: toString(raw?.iccid),
    orderReference: providerOrderNo || esimTranNo || toString(raw?.iccid || raw?.id),
    customFields,
    custom_fields: customFields,
    purchaseSnapshot: {
      ...checkoutSnapshot,
      name: planName,
      country: countryName,
      countryCode,
    },
    raw,
  };
}

export async function getMyEsims(): Promise<ApiResponse<any[]>> {
  const authError = requireUserId();
  if (authError) {
    return authError;
  }

  const syncedUsageRows = await (async () => {
    const endpoints = ["/esim-access/usage/sync/my", "/esim-access/usage/refresh/my"];

    for (const endpoint of endpoints) {
      const response = await Promise.race<ApiResponse<any>>([
        requestApi(endpoint, {
          method: "POST",
          includeAuth: true,
        }),
        new Promise<ApiResponse<any>>((resolve) => {
          setTimeout(() => resolve(toTimeoutUsageSyncResponse()), USAGE_SYNC_TIMEOUT_MS);
        }),
      ]);

      if (response.success) {
        return extractProfileRowsFromPayload(response);
      }

      const errorText = toString(response.error).toLowerCase();
      const canFallback =
        errorText.includes("not found") ||
        errorText.includes("status 404") ||
        errorText.includes("status 405") ||
        errorText.includes("method not allowed");
      if (!canFallback) {
        break;
      }
    }

    return [] as any[];
  })();

  const queries: AnyRecord[] = [
    { limit: 100, offset: 0, ts: Date.now() },
    { limit: 100, offset: 0, status: "all", ts: Date.now() },
    {
      limit: 100,
      offset: 0,
      includeInactive: true,
      includeUninstalled: true,
      includeNotInstalled: true,
      onlyInstalled: false,
      status: "all",
      ts: Date.now(),
    },
  ];
  let rows: any[] = mergeRowsByIdentity([], syncedUsageRows);

  for (const query of queries) {
    const response = await requestApi("/esim-access/profiles/my", { includeAuth: true, query });
    if (!response.success) {
      if (rows.length === 0) {
        return response as ApiResponse<any[]>;
      }
      continue;
    }
    rows = mergeRowsByIdentity(rows, extractProfileRowsFromPayload(response));
  }

  return { success: true, data: rows.map(normalizeProfileRowForPage) };
}

export async function activateEsim(
  esimId: string,
  identifiers: { iccid?: string; esimTranNo?: string; providerOrderNo?: string; id?: string } = {},
): Promise<ApiResponse<any>> {
  const authError = requireUserId();
  if (authError) {
    return authError;
  }

  const iccid = toString(identifiers.iccid);
  const esimTranNo = toString(identifiers.esimTranNo);
  const providerOrderNo = toString(identifiers.providerOrderNo);
  const id = toString(identifiers.id || esimId);
  const body: AnyRecord = {
    ...(iccid ? { iccid } : {}),
    ...(esimTranNo ? { esimTranNo } : {}),
    ...(providerOrderNo ? { providerOrderNo } : {}),
    ...(id ? { id } : {}),
    platformCode: "tulip_mobile_app",
    note: "User activated eSIM from mobile app",
  };

  if (!body.iccid && !body.esimTranNo && !body.providerOrderNo && !body.id) {
    return { success: false, error: "An eSIM identifier is required to activate this eSIM." };
  }

  const response = await requestApi("/esim-access/profiles/activate/my", {
    method: "POST",
    body,
    includeAuth: true,
  });
  const error = toString(response.error).toLowerCase();
  if (!response.success && (error.includes("already active") || error.includes("already activated"))) {
    return { success: true, data: { iccid, esimTranNo, providerOrderNo, id, status: "active" } };
  }
  return response;
}

export async function topUpEsim(
  esimId: string,
  planId: string,
  options?: { transactionId?: string; esimTranNo?: string; iccid?: string },
): Promise<ApiResponse<any>> {
  const authError = requireUserId();
  if (authError) {
    return authError;
  }

  const packageCode = toString(planId);
  const transactionId = toString(options?.transactionId) || createPurchaseTransactionId("TOPUP");
  if (!packageCode) {
    return { success: false, error: "Top-up package code is required." };
  }

  return requestApi("/esim-access/topup/managed", {
    method: "POST",
    body: {
      providerRequest: {
        packageCode,
        transactionId,
        esimTranNo: toString(options?.esimTranNo) || undefined,
        iccid: toString(options?.iccid) || undefined,
      },
      platformCode: "tulip_mobile_app",
      platformName: "Tulip Mobile App",
      actorPhone: getUserPhone() || undefined,
      syncAfterTopup: true,
      userId: getUserId() || undefined,
      esimId,
    },
    includeAuth: true,
  });
}

function extractEsimListFromPurchasePayload(payload: AnyRecord): AnyRecord[] {
  const roots: AnyRecord[] = [];
  const pushRoot = (value: unknown) => {
    if (value && typeof value === "object") {
      roots.push(value as AnyRecord);
    }
  };

  pushRoot(payload);
  pushRoot(payload?.data);
  pushRoot(payload?.sync);
  pushRoot(payload?.order);
  pushRoot(payload?.order?.sync);
  pushRoot(payload?.order?.provider);
  pushRoot(payload?.provider);
  pushRoot(payload?.obj);

  for (const root of roots) {
    const candidates = [
      root?.sync?.provider?.obj?.esimList,
      root?.provider?.obj?.esimList,
      root?.obj?.esimList,
      root?.esimList,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate as AnyRecord[];
      }
    }
  }

  return [];
}

export function saveMyEsimShadowFromPurchaseResult(
  purchaseResult: unknown,
  checkoutContext?: {
    country?: { name?: string; code?: string; flag?: string };
    plan?: { id?: string; data?: number; validity?: number; price?: number };
  },
): void {
  const userId = toString(getUserId());
  if (!userId || !purchaseResult || typeof purchaseResult !== "object") {
    return;
  }

  const payload = purchaseResult as AnyRecord;
  const esimList = extractEsimListFromPurchasePayload(payload);
  const orderNoFallback = toString(
    payload?.order?.provider?.obj?.orderNo ||
      payload?.provider?.obj?.orderNo ||
      payload?.order?.database?.providerOrderNo ||
      payload?.order?.providerOrderNo ||
      payload?.order?.provider_order_no ||
      payload?.order?.orderNo ||
      payload?.order?.order_no ||
      payload?.order?.obj?.orderNo ||
      payload?.order?.obj?.order_no ||
      payload?.orderNo ||
      payload?.order_no ||
      payload?.providerOrderNo ||
      payload?.provider_order_no ||
      payload?.obj?.orderNo ||
      payload?.obj?.order_no,
  );
  const transactionFallback = toString(
    payload?.order?.provider?.obj?.transactionId ||
      payload?.order?.provider?.transactionId ||
      payload?.order?.provider?.transaction_id ||
      payload?.order?.transactionId ||
      payload?.order?.transaction_id ||
      payload?.transactionId ||
      payload?.transaction_id ||
      payload?.paymentTransactionId ||
      payload?.payment_transaction_id ||
      payload?.payment?.transactionId ||
      payload?.payment?.transaction_id,
  );
  const planFallback = toString(checkoutContext?.plan?.id || checkoutContext?.plan?.data || "");
  const countryCodeFallback = toUpper(checkoutContext?.country?.code);
  const optimisticReference = toString(
    orderNoFallback ||
      transactionFallback ||
      (countryCodeFallback && planFallback ? `optimistic-${countryCodeFallback}-${planFallback}` : ""),
  );

  const now = Date.now();
  const fromEsimList = esimList
    .map((entry: AnyRecord, index) => {
      const packageRow = Array.isArray(entry?.packageList) && entry.packageList.length > 0 ? entry.packageList[0] : {};
      const countryCode = toUpper(packageRow?.locationCode || checkoutContext?.country?.code);
      const countryName = toString(checkoutContext?.country?.name || resolveCountryName(countryCode) || countryCode || "Unknown");
      const totalDataMb = normalizeVolumeToMb(entry?.totalVolume ?? entry?.total_volume ?? entry?.totalDataMb);
      const packageName = toString(packageRow?.packageName || countryName || "Travel Plan");
      const providerOrderNo = toString(entry?.orderNo || orderNoFallback);
      const esimTranNo = toString(entry?.esimTranNo);
      const iccid = toString(entry?.iccid);
      const activationCode = toString(entry?.ac);
      const installUrl = toString(entry?.shortUrl);
      const qrCodeUrl = toString(entry?.qrCodeUrl);
      const shadowId = toString(`shadow-${providerOrderNo || esimTranNo || iccid || now}-${index + 1}`);

      return {
        id: shadowId,
        user_id: userId,
        userId,
        iccid,
        country_code: countryCode,
        countryCode,
        country_name: countryName,
        countryName,
        status: "inactive",
        installed: false,
        installed_at: "",
        installedAt: "",
        activated_at: "",
        activatedAt: "",
        expires_at: toString(entry?.expiredTime || ""),
        expiresAt: toString(entry?.expiredTime || ""),
        totalDataMb,
        packageDataMb: totalDataMb,
        usedDataMb: 0,
        remainingDataMb: totalDataMb,
        dataTotalMb: totalDataMb,
        dataUsedMb: 0,
        dataRemainingMb: totalDataMb,
        activation_code: activationCode,
        activationCode,
        qr_code_url: qrCodeUrl,
        qrCodeUrl,
        install_url: installUrl,
        installUrl,
        esim_tran_no: esimTranNo,
        esimTranNo,
        provider_order_no: providerOrderNo,
        providerOrderNo,
        custom_fields: {
          usageUnit: "MB",
          packageDataMb: totalDataMb,
          packageName,
          countryCode,
          countryName,
          checkoutSnapshot: checkoutContext?.country && checkoutContext?.plan
            ? { country: checkoutContext.country, plan: checkoutContext.plan }
            : undefined,
          shadowStatus: toString(entry?.esimStatus || entry?.smdpStatus || "GOT_RESOURCE"),
        },
        __shadowCreatedAt: now,
      } as AnyRecord;
    })
    .filter((row) => Boolean(getRowIdentityKey(row)));

  const fallbackRows: AnyRecord[] = [];
  if (fromEsimList.length === 0 && (optimisticReference || checkoutContext?.country || checkoutContext?.plan)) {
    const countryCode = countryCodeFallback;
    const countryName = toString(checkoutContext?.country?.name || resolveCountryName(countryCode) || countryCode || "Unknown");
    const fallbackDataMb = Math.max(0, Math.round(toNumber(checkoutContext?.plan?.data, 0) * 1024));
    const fallbackReference = optimisticReference || `shadow-${now}`;
    fallbackRows.push({
      id: toString(`shadow-${fallbackReference}-fallback`),
      user_id: userId,
      userId,
      iccid: "",
      country_code: countryCode,
      countryCode,
      country_name: countryName,
      countryName,
      status: "inactive",
      installed: false,
      installed_at: "",
      installedAt: "",
      activated_at: "",
      activatedAt: "",
      expires_at: "",
      expiresAt: "",
      totalDataMb: fallbackDataMb,
      packageDataMb: fallbackDataMb,
      usedDataMb: 0,
      remainingDataMb: fallbackDataMb,
      dataTotalMb: fallbackDataMb,
      dataUsedMb: 0,
      dataRemainingMb: fallbackDataMb,
      activation_code: "",
      activationCode: "",
      qr_code_url: "",
      qrCodeUrl: "",
      install_url: "",
      installUrl: "",
      esim_tran_no: "",
      esimTranNo: "",
      provider_order_no: fallbackReference,
      providerOrderNo: fallbackReference,
      custom_fields: {
        usageUnit: "MB",
        packageDataMb: fallbackDataMb,
        packageName: countryName || "Travel Plan",
        countryCode,
        countryName,
        checkoutSnapshot: checkoutContext?.country && checkoutContext?.plan
          ? { country: checkoutContext.country, plan: checkoutContext.plan }
          : undefined,
        shadowStatus: "BOOKED",
      },
      __shadowCreatedAt: now,
    } as AnyRecord);
  }

  const newRows = [...fromEsimList, ...fallbackRows].filter((row) => Boolean(getRowIdentityKey(row)));
  if (newRows.length === 0) {
    return;
  }

  const mergedByKey = new Map<string, AnyRecord>();
  [...readMyEsimsShadowRows(), ...newRows].forEach((row) => {
    const key = getRowIdentityKey(row);
    if (key) {
      mergedByKey.set(key, row);
    }
  });
  writeMyEsimsShadowRows(Array.from(mergedByKey.values()));
  try {
    window.dispatchEvent(new CustomEvent("tulip:my-esims-shadow-updated"));
  } catch {
    // Ignore dispatch failures in non-browser runtimes.
  }
}

function toTimeoutApiResponse<T = any>(): ApiResponse<T> {
  return { success: false, error: "Order lifecycle lookup timed out" };
}

function toTimeoutTopUpResponse<T = any>(): ApiResponse<T> {
  return { success: false, error: "Top-up lookup timed out" };
}

function toTimeoutUsageSyncResponse<T = any>(): ApiResponse<T> {
  return { success: false, error: "Usage sync timed out" };
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
  return item.status === "expired";
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

function resolveBundleExpiresAt(row: any, raw: any): string {
  const directCandidates: unknown[] = [
    row?.bundleExpiresAt,
    row?.bundle_expires_at,
    raw?.bundleExpiresAt,
    raw?.bundle_expires_at,
    row?.packageExpiresAt,
    row?.package_expires_at,
    raw?.packageExpiresAt,
    raw?.package_expires_at,
    row?.customFields?.bundleExpiresAt,
    row?.customFields?.bundle_expires_at,
    row?.custom_fields?.bundleExpiresAt,
    row?.custom_fields?.bundle_expires_at,
    raw?.customFields?.bundleExpiresAt,
    raw?.customFields?.bundle_expires_at,
    raw?.custom_fields?.bundleExpiresAt,
    raw?.custom_fields?.bundle_expires_at,
    row?.customFields?.packageExpiresAt,
    row?.customFields?.package_expires_at,
    row?.custom_fields?.packageExpiresAt,
    row?.custom_fields?.package_expires_at,
    raw?.customFields?.packageExpiresAt,
    raw?.customFields?.package_expires_at,
    raw?.custom_fields?.packageExpiresAt,
    raw?.custom_fields?.package_expires_at,
  ];

  for (const value of directCandidates) {
    const text = String(value || "").trim();
    if (!text) {
      continue;
    }
    if (Number.isFinite(parseDateToMs(text))) {
      return text;
    }
  }

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

  for (const source of snapshotSources) {
    const snapshot = parseObjectCandidate(source);
    if (Object.keys(snapshot).length === 0) {
      continue;
    }
    const plan = parseObjectCandidate(snapshot?.plan);
    const candidates = [
      snapshot?.bundleExpiresAt,
      snapshot?.bundle_expires_at,
      snapshot?.expiresAt,
      snapshot?.expires_at,
      plan?.bundleExpiresAt,
      plan?.bundle_expires_at,
      plan?.expiresAt,
      plan?.expires_at,
    ];
    for (const candidate of candidates) {
      const text = String(candidate || "").trim();
      if (!text) {
        continue;
      }
      if (Number.isFinite(parseDateToMs(text))) {
        return text;
      }
    }
  }

  return "";
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
    return cardData;
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

function isMobileRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = String(window.navigator?.userAgent || "").toLowerCase();
  return /android|iphone|ipad|ipod/.test(userAgent);
}

function buildPreferredActivationUrl(installUrl: string, activationCode: string): string {
  const cardData = extractActivationCardData(installUrl, activationCode);
  if (isNativeIosRuntime() && cardData && /^lpa:/i.test(cardData)) {
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

function canLaunchActivationUrl(url: string): boolean {
  const text = String(url || "").trim();
  if (!text) {
    return false;
  }

  if (/^https:\/\/esimsetup\.apple\.com\/esim_qrcode_provisioning/i.test(text)) {
    return isNativeIosRuntime();
  }

  if (/^lpa:/i.test(text)) {
    return isMobileRuntime();
  }

  return false;
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

function buildQrPayload(installUrl: string, activationCode: string, activationUrl: string, qrCodeUrl: string): string {
  const directQrUrl = String(qrCodeUrl || "").trim();
  if (/^https?:\/\//i.test(directQrUrl)) {
    return directQrUrl;
  }

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
  if (/^https?:\/\//i.test(text) && !/^https:\/\/esimsetup\.apple\.com\/esim_qrcode_provisioning/i.test(text)) {
    return text;
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
  const rawStatus = String(row?.status || raw?.status || "inactive");

  const usageCustomFields = {
    ...parseObjectCandidate(row?.custom_fields),
    ...parseObjectCandidate(row?.customFields),
    ...parseObjectCandidate(raw?.custom_fields),
    ...parseObjectCandidate(raw?.customFields),
  };
  const usage = normalizeUsageMb({ ...raw, ...row }, usageCustomFields);
  const dataUsed = usage.usedMb;
  const dataTotal = usage.totalMb;
  const dataRemaining = usage.remainingMb;

  const normalizedRawStatus = rawStatus.trim().toLowerCase();
  const backendDaysLeftRaw = row?.daysLeft ?? raw?.daysLeft;
  const hasBackendDaysLeft = backendDaysLeftRaw !== null && backendDaysLeftRaw !== undefined && String(backendDaysLeftRaw).trim() !== "";
  const backendDaysLeft = hasBackendDaysLeft
    ? Math.max(0, Math.floor(extractNumber(backendDaysLeftRaw, 0)))
    : -1;
  const bundleExpiresAt = resolveBundleExpiresAt(row, raw);
  const validityDays = Math.max(
    0,
    Math.floor(
      extractNumber(
        row?.validityDays ??
          row?.validity_days ??
          raw?.validityDays ??
          raw?.validity_days ??
          row?.customFields?.validityDays ??
          row?.customFields?.validity_days ??
          row?.custom_fields?.validityDays ??
          row?.custom_fields?.validity_days ??
          raw?.customFields?.validityDays ??
          raw?.customFields?.validity_days ??
          raw?.custom_fields?.validityDays ??
          raw?.custom_fields?.validity_days,
        0,
      ),
    ),
  );
  const statusFromBackend: MyEsimStatus =
    normalizedRawStatus === "expired"
      ? "expired"
      : normalizedRawStatus === "active" && isInstalled
      ? "active"
      : "inactive";

  const activationCode = String(
    raw?.activationCode ||
    raw?.activation_code ||
    row?.activationCode ||
    row?.activation_code ||
    row?.customFields?.activationCode ||
    row?.customFields?.activation_code ||
    row?.custom_fields?.activationCode ||
    row?.custom_fields?.activation_code ||
    raw?.customFields?.activationCode ||
    raw?.customFields?.activation_code ||
    raw?.custom_fields?.activationCode ||
    raw?.custom_fields?.activation_code ||
    row?.qrCode ||
    raw?.qrCode ||
    "",
  ).trim();
  const qrCodeUrl = String(
    raw?.qrCodeUrl ||
      raw?.qr_code_url ||
      row?.qrCodeUrl ||
      row?.qr_code_url ||
      row?.customFields?.qrCodeUrl ||
      row?.customFields?.qr_code_url ||
      row?.custom_fields?.qrCodeUrl ||
      row?.custom_fields?.qr_code_url ||
      raw?.customFields?.qrCodeUrl ||
      raw?.customFields?.qr_code_url ||
      raw?.custom_fields?.qrCodeUrl ||
      raw?.custom_fields?.qr_code_url ||
      "",
  ).trim();
  const installUrl = normalizeInstallUrl(
    raw?.installUrl ||
      raw?.install_url ||
      raw?.shortUrl ||
      raw?.short_url ||
      row?.installUrl ||
      row?.install_url ||
      row?.shortUrl ||
      row?.short_url ||
      row?.customFields?.installUrl ||
      row?.customFields?.install_url ||
      row?.customFields?.shortUrl ||
      row?.customFields?.short_url ||
      row?.custom_fields?.installUrl ||
      row?.custom_fields?.install_url ||
      row?.custom_fields?.shortUrl ||
      row?.custom_fields?.short_url ||
      raw?.customFields?.installUrl ||
      raw?.customFields?.install_url ||
      raw?.customFields?.shortUrl ||
      raw?.customFields?.short_url ||
      raw?.custom_fields?.installUrl ||
      raw?.custom_fields?.install_url ||
      raw?.custom_fields?.shortUrl ||
      raw?.custom_fields?.short_url,
  );
  const activationUrl = buildActivationInstallUrl(installUrl, activationCode);
  const qrPayload = buildQrPayload(installUrl, activationCode, activationUrl, qrCodeUrl);
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
  if (statusFromBackend === "active" && hasActivationDate && backendDaysLeft >= 0) {
    // Backend profiles/my `daysLeft` is the countdown source of truth.
    daysLeft = backendDaysLeft;
    hasDaysLeft = true;
  }
  if (statusFromBackend === "active" && hasActivationDate && daysLeft < 0) {
    const bundleExpiresMs = parseDateToMs(bundleExpiresAt);
    if (Number.isFinite(bundleExpiresMs)) {
      daysLeft = Math.max(0, Math.ceil((bundleExpiresMs - Date.now()) / (24 * 60 * 60 * 1000)));
      hasDaysLeft = true;
    } else if (validityDays > 0) {
      const activatedMs = parseDateToMs(activatedDate);
      if (Number.isFinite(activatedMs)) {
        const expiresMs = activatedMs + validityDays * 24 * 60 * 60 * 1000;
        daysLeft = Math.max(0, Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000)));
        hasDaysLeft = true;
      }
    }
  }
  if (statusFromBackend !== "active" || !isActivated) {
    hasDaysLeft = false;
    daysLeft = -1;
  }
  const activationPendingKeyParts = [orderReference, raw?.iccid || row?.iccid, id, activationCode];
  const displayDaysLeft = hasDaysLeft ? daysLeft : 0;
  const validUntil = resolveValidUntil(
    bundleExpiresAt,
    displayDaysLeft,
    isActivated,
  );
  const resolvedActivatedDate = activatedDate;
  if (statusFromBackend === "expired" || isActivated) {
    clearActivationPending(activationPendingKeyParts);
  }
  const finalStatus = statusFromBackend;

  const countryCode = resolveCountryCode(row, raw, countryCodeByName);
  const flag = resolveDisplayFlag(raw?.flag || row?.flag, countryCode);
  const supportTopUpType = resolveSupportTopUpType(row, raw);
  const topUp = topUpSupport.get(countryCode) || { hasTopUp: false, planId: "" };
  const hasTopUp = supportTopUpType > 0;
  const canTopUp = hasTopUp;

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
    qrCodeUrl,
    installUrl,
    activationUrl,
    qrPayload,
    hasTopUp,
    topUpPlanId: hasTopUp ? (topUp.planId || "") : "",
    canShowQr: finalStatus !== "expired" && Boolean(qrPayload || activationCode || qrCodeUrl),
    canActivate:
      finalStatus === "inactive" &&
      !isActivated &&
      Boolean(qrPayload || row?.iccid || raw?.iccid || transactionId || orderReference || id),
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
        return;
      }

      const currentInstallScore = readEsimInstallCompletenessScore(current);
      const nextInstallScore = readEsimInstallCompletenessScore(item);
      if (nextInstallScore > currentInstallScore) {
        byKey.set(key, item);
        return;
      }

      const currentFreshness = readRowFreshnessMs(current as any);
      const nextFreshness = readRowFreshnessMs(item as any);
      if (nextFreshness > currentFreshness) {
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

function extractTopUpPackageRows(payload: any): any[] {
  const roots = [
    payload,
    payload?.data,
    payload?.data?.data,
    payload?.obj,
    payload?.data?.obj,
  ];

  for (const root of roots) {
    if (Array.isArray(root)) {
      return root;
    }
    if (Array.isArray(root?.packageList)) {
      return root.packageList;
    }
    if (Array.isArray(root?.packages)) {
      return root.packages;
    }
    if (Array.isArray(root?.list)) {
      return root.list;
    }
    if (Array.isArray(root?.items)) {
      return root.items;
    }
  }

  return [];
}

async function resolveTopUpPackageCode(esim: MyEsimItem): Promise<string> {
  const existing = String(esim.topUpPlanId || "").trim();
  if (existing) {
    return existing;
  }

  const iccid = String(esim.iccid || "").trim();
  if (!iccid) {
    return "";
  }

  const response = await requestApi("/esim-access/packages/query", {
    method: "POST",
    body: {
      type: "TOPUP",
      iccid,
    },
    includeAuth: true,
  });
  if (!response.success) {
    return "";
  }

  const rows = extractTopUpPackageRows(response);
  const sorted = [...rows].sort((a, b) => {
    const aPrice = toNumber(a?.price ?? a?.retailPrice ?? a?.salePrice, Number.MAX_SAFE_INTEGER);
    const bPrice = toNumber(b?.price ?? b?.retailPrice ?? b?.salePrice, Number.MAX_SAFE_INTEGER);
    return aPrice - bPrice;
  });

  const candidate = sorted.find((row) => {
    const code = String(row?.packageCode || row?.package_code || row?.id || row?.bundleName || "").trim();
    return Boolean(code);
  });

  return candidate
    ? String(candidate?.packageCode || candidate?.package_code || candidate?.id || candidate?.bundleName || "").trim()
    : "";
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
  const includeOrderLifecycle = options.includeOrderLifecycle === true;
  const includeDestinationLookup = options.includeDestinationLookup !== false;

  const [myEsimsResponse, destinationsResponse] = await Promise.all([
    getMyEsims(),
    includeDestinationLookup ? getAllDestinations() : Promise.resolve<ApiResponse<any[]>>({ success: true, data: [] }),
  ]);

  if (!myEsimsResponse.success) {
    const cached = readMyEsimsSnapshot();
    const shadowRows = readMyEsimsShadowRows();
    if (cached.length === 0 && shadowRows.length === 0) {
      return [];
    }
    const activationPendingCache = readActivationPendingCache();
    const countryCodeByName = buildCountryCodeByName([]);
    const normalizedShadows = shadowRows.map((row: any) =>
      normalizeMyEsim(row, countryCodeByName, new Map<string, TopUpSupport>(), activationPendingCache),
    );
    return dedupeEsims([...cached, ...normalizedShadows]);
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
    const hasTopUp = Boolean(item.hasTopUp);
    const canTopUp = hasTopUp;
    return {
      ...item,
      hasTopUp,
      topUpPlanId: hasTopUp ? (topUp.planId || item.topUpPlanId || "") : "",
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
      const hasTopUp = Boolean(item.hasTopUp);
      const canTopUp = hasTopUp;
      return {
        ...item,
        hasTopUp,
        topUpPlanId: hasTopUp ? (topUp.planId || item.topUpPlanId || "") : "",
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

  const activeEsims = useMemo(
    () => esims.filter((esim) => esim.status === "active"),
    [esims],
  );
  const inactiveEsims = useMemo(
    () => esims.filter((esim) => esim.status === "inactive"),
    [esims],
  );
  const expiredEsims = useMemo(() => esims.filter((esim) => esim.status === "expired"), [esims]);

  const loadVerifiedEsims = async (): Promise<MyEsimItem[]> => {
    try {
      const verifiedRows = await loadMyEsimsPageContent({
        includeOrderLifecycle: false,
        includeTopUpSupport: false,
      });
      setEsims(verifiedRows);
      setLoading(false);
      lastRefreshAtRef.current = Date.now();
      writeMyEsimsSnapshot(verifiedRows);

      const hydratedRows = await hydrateTopUpSupportOnEsims(verifiedRows);
      setEsims(hydratedRows);
      writeMyEsimsSnapshot(hydratedRows);
      return hydratedRows;
    } catch (error) {
      console.warn("My eSIM refresh failed; keeping cached snapshot.", error);
      const cached = readMyEsimsSnapshot();
      if (cached.length > 0) {
        setEsims(cached);
      }
      setLoading(false);
      return cached;
    }
  };

  const refreshEsims = async (showLoader = false, force = false): Promise<MyEsimItem[]> => {
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < ESIMS_REFRESH_THROTTLE_MS) {
      return esims;
    }

    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return readMyEsimsSnapshot();
    }

    let refreshedRows: MyEsimItem[] = [];
    const task = (async () => {
      if (showLoader) {
        setLoading(true);
      }
      refreshedRows = await loadVerifiedEsims();
    })().finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = task;
    await task;
    if (refreshedRows.length > 0) {
      return refreshedRows;
    }
    return readMyEsimsSnapshot();
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
    const handleShadowUpdated = () => {
      if (!mounted) {
        return;
      }
      void loadFastEsims();
    };

    void load();
    window.addEventListener("focus", handleResume);
    window.addEventListener("tulip:my-esims-shadow-updated", handleShadowUpdated);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("tulip:my-esims-shadow-updated", handleShadowUpdated);
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

  const resolveQrEsim = async (esim: MyEsimItem): Promise<MyEsimItem> => {
    const refreshed = await refreshEsims(false, true);
    const refreshedMatch = findBestMatchingEsim(refreshed, esim);
    if (refreshedMatch) {
      return refreshedMatch;
    }

    const localMatch = findBestMatchingEsim(esims, esim);
    return localMatch || esim;
  };

  const handleQrInstalled = async (esim: MyEsimItem) => {
    const latestEsim = await resolveQrEsim(esim);
    if (!latestEsim.canActivate) {
      await refreshEsims(false, true);
      return;
    }

    setBusyEsimId(latestEsim.id);
    const response = await activateEsim(latestEsim.id, {
      iccid: latestEsim.iccid,
      esimTranNo: latestEsim.transactionId,
      providerOrderNo: latestEsim.orderReference,
      id: latestEsim.id,
    });
    setBusyEsimId("");

    if (!response.success) {
      toast.error("Activation sync is still pending", {
        description: response.error || "Please refresh in a few seconds.",
      });
      await refreshEsims(false, true);
      return;
    }

    markActivationPending([latestEsim.orderReference, latestEsim.iccid, latestEsim.id, latestEsim.activationCode]);
    toast.success("Activation synced");
    await refreshEsims(false, true);
    setSelectedTab("active");
  };

  const handleActivate = async (esim: MyEsimItem) => {
    if (!esim.canActivate) {
      toast.error("This eSIM is already activated.");
      return;
    }

    setBusyEsimId(esim.id);
    const response = await activateEsim(esim.id, {
      iccid: esim.iccid,
      esimTranNo: esim.transactionId,
      providerOrderNo: esim.orderReference,
      id: esim.id,
    });
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
      if (response.success) {
        toast.success("Activation request submitted");
      } else {
        toast.error("Activation link is not available yet.");
      }
      await refreshEsims(false, true);
      return;
    }

    if (!canLaunchActivationUrl(nextActivationUrl)) {
      toast.error("Open this from your phone", {
        description: "This device cannot launch eSIM installation links. Use View QR on mobile.",
      });
      await refreshEsims(false, true);
      return;
    }

    markActivationPending([esim.orderReference, esim.iccid, esim.id, esim.activationCode]);
    markEsimPendingInUi(esim);
    void refreshEsims(false, true);
    toast.success("Opening activation");
    window.location.replace(nextActivationUrl);
  };

  const handleTopUp = async (esim: MyEsimItem) => {
    if (!esim.canTopUp) {
      return;
    }

    setBusyEsimId(esim.id);
    const packageCode = await resolveTopUpPackageCode(esim);
    if (!packageCode) {
      setBusyEsimId("");
      toast.error("Top up failed", {
        description: "No top-up package is available for this eSIM yet.",
      });
      return;
    }

    const response = await topUpEsim(
      esim.id,
      packageCode,
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
    resolveQrEsim,
    handleQrInstalled,
    refresh: async (force = false) => {
      await refreshEsims(false, force);
    },
    handleActivate,
    handleTopUp,
  };
}
