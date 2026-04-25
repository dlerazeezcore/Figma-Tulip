import { getApiBaseCandidates, isBackendCapabilityEnabled } from "./config";
import { requestApi } from "./http";
import { getAuthToken, getUserName, getUserPhone } from "./session";
import type { ApiResponse, AnyRecord } from "./types";

const BYTES_PER_GB = 1024 * 1024 * 1024;
const POPULAR_METRICS_CACHE_TTL_MS = 60 * 1000;
const AUTH_REQUEST_TIMEOUT_MS = 30_000;
const popularMetricsCache = new Map<string, { value: { priceFrom: number; plansCount: number }; expiresAt: number }>();

function getApiOriginCandidates(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const addCandidate = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      return;
    }

    try {
      const origin = new URL(trimmed).origin;
      if (!origin || seen.has(origin)) {
        return;
      }
      seen.add(origin);
      out.push(origin);
    } catch {
      // Ignore malformed entries.
    }
  };

  getApiBaseCandidates().forEach(addCandidate);
  return out;
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

function unsupported(feature: string): ApiResponse {
  return {
    success: false,
    error: `${feature} is not available in backendformobileapp yet.`,
  };
}

function unsupportedNoop(feature: string): ApiResponse {
  return {
    success: true,
    data: {
      skipped: true,
      reason: `${feature} is not available in backendformobileapp yet.`,
    },
  };
}

function countryFlag(code: string): string {
  const iso = String(code || "").trim().toUpperCase();
  if (iso.length !== 2) {
    return "🌍";
  }
  return String.fromCodePoint(127397 + iso.charCodeAt(0), 127397 + iso.charCodeAt(1));
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

function mapProfileStatus(row: any): string {
  const raw = String(
    row?.status ||
      row?.app_status ||
      row?.provider_status ||
      "",
  ).trim().toLowerCase();
  const terminal = ["expired", "cancelled", "canceled", "revoked", "refunded", "voided", "closed"];
  if (terminal.some((keyword) => raw.includes(keyword))) {
    return "expired";
  }
  if (raw === "active") {
    return "active";
  }
  if (raw === "pending") {
    return "pending";
  }
  if (raw === "inactive") {
    return "inactive";
  }
  return "inactive";
}

function pickFirstNonNegativeNumber(values: unknown[]): number | null {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function pickSmallestPositiveInt(values: unknown[]): number {
  let smallest = Number.POSITIVE_INFINITY;
  for (const value of values) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      continue;
    }
    smallest = Math.min(smallest, Math.floor(parsed));
  }
  return Number.isFinite(smallest) ? smallest : 0;
}

function normalizeUsageUnit(value: unknown): "MB" | "GB" | "KB" {
  const unit = String(value ?? "").trim().toUpperCase();
  if (unit === "GB" || unit === "KB" || unit === "MB") {
    return unit;
  }
  return "MB";
}

function convertToMb(value: number | null, unit: "MB" | "GB" | "KB"): number {
  if (!Number.isFinite(Number(value)) || Number(value) < 0) {
    return 0;
  }
  const numeric = Number(value);
  if (unit === "GB") {
    return numeric * 1024;
  }
  if (unit === "KB") {
    return numeric / 1024;
  }
  return numeric;
}

function extractCanonicalUsageMb(row: any): { totalMb: number; usedMb: number; remainingMb: number; usageUnit: "MB" } {
  const usageUnit = normalizeUsageUnit(row?.usageUnit ?? row?.usage_unit);

  const packageDataRaw = pickFirstNonNegativeNumber([
    row?.packageDataMb,
    row?.package_data_mb,
    row?.custom_fields?.packageDataMb,
    row?.custom_fields?.package_data_mb,
    row?.customFields?.packageDataMb,
    row?.customFields?.package_data_mb,
  ]);

  const totalDataRaw = pickFirstNonNegativeNumber([
    row?.totalDataMb,
    row?.total_data_mb,
    row?.custom_fields?.totalDataMb,
    row?.custom_fields?.total_data_mb,
    row?.customFields?.totalDataMb,
    row?.customFields?.total_data_mb,
  ]);

  const usedDataRaw = pickFirstNonNegativeNumber([
    row?.usedDataMb,
    row?.used_data_mb,
    row?.custom_fields?.usedDataMb,
    row?.custom_fields?.used_data_mb,
    row?.customFields?.usedDataMb,
    row?.customFields?.used_data_mb,
  ]);

  const remainingDataRaw = pickFirstNonNegativeNumber([
    row?.remainingDataMb,
    row?.remaining_data_mb,
    row?.custom_fields?.remainingDataMb,
    row?.custom_fields?.remaining_data_mb,
    row?.customFields?.remainingDataMb,
    row?.customFields?.remaining_data_mb,
  ]);

  const packageDataMb = convertToMb(packageDataRaw, usageUnit);
  const totalDataMb = packageDataMb > 0 ? packageDataMb : convertToMb(totalDataRaw, usageUnit);
  const usedDataMb = convertToMb(usedDataRaw, usageUnit);
  const providedRemainingMb = convertToMb(remainingDataRaw, usageUnit);

  const totalMb = Math.max(0, totalDataMb);
  const usedMb = totalMb > 0 ? Math.min(Math.max(0, usedDataMb), totalMb) : Math.max(0, usedDataMb);
  const remainingMb = Number.isFinite(providedRemainingMb) && providedRemainingMb > 0
    ? Math.max(0, Math.min(providedRemainingMb, totalMb > 0 ? totalMb : providedRemainingMb))
    : totalMb > 0
    ? Math.max(0, totalMb - usedMb)
    : 0;

  return {
    totalMb,
    usedMb,
    remainingMb,
    usageUnit: "MB",
  };
}

function computeValidityDays(row: any): number {
  return pickSmallestPositiveInt([
    row?.packageValidityDays,
    row?.package_validity_days,
    row?.planValidityDays,
    row?.plan_validity_days,
    row?.durationDays,
    row?.duration_days,
    row?.validityDays,
    row?.validity_days,
    row?.validity,
    row?.custom_fields?.packageValidityDays,
    row?.custom_fields?.package_validity_days,
    row?.custom_fields?.planValidityDays,
    row?.custom_fields?.plan_validity_days,
    row?.custom_fields?.durationDays,
    row?.custom_fields?.duration_days,
    row?.custom_fields?.validityDays,
    row?.custom_fields?.validity_days,
    row?.customFields?.packageValidityDays,
    row?.customFields?.package_validity_days,
    row?.customFields?.planValidityDays,
    row?.customFields?.plan_validity_days,
    row?.customFields?.durationDays,
    row?.customFields?.duration_days,
    row?.customFields?.validityDays,
    row?.customFields?.validity_days,
  ]);
}

function computeDaysLeft(row: any, validityDays: number): number {
  const explicitCandidate = pickFirstNonNegativeNumber([
    row?.daysLeft,
    row?.days_left,
    row?.remainingDays,
    row?.remaining_days,
    row?.custom_fields?.daysLeft,
    row?.custom_fields?.days_left,
    row?.customFields?.daysLeft,
    row?.customFields?.days_left,
  ]);
  if (explicitCandidate !== null) {
    return Math.max(0, Math.floor(explicitCandidate));
  }

  const expiresAt = String(
    row?.expiresAt ||
      row?.expires_at ||
      row?.validUntil ||
      row?.valid_until ||
      "",
  ).trim();
  if (expiresAt) {
    const expiresAtMs = Date.parse(expiresAt);
    if (Number.isFinite(expiresAtMs)) {
      const delta = expiresAtMs - Date.now();
      return Math.max(0, Math.ceil(delta / (24 * 60 * 60 * 1000)));
    }
  }
  return -1;
}

function normalizePhone(phone: string): string {
  return String(phone || "").trim();
}

function normalizeName(name: string): string {
  return String(name || "").trim() || "User";
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toString(value: unknown): string {
  return String(value ?? "").trim();
}

function toUpper(value: unknown): string {
  return toString(value).toUpperCase();
}

function toObjectRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function parseObjectCandidate(value: unknown): AnyRecord {
  if (value && typeof value === "object") {
    return value as AnyRecord;
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as AnyRecord) : {};
  } catch {
    return {};
  }
}

function mergeProfileCustomFields(row: AnyRecord): AnyRecord {
  const snake = parseObjectCandidate(row?.custom_fields);
  const camel = parseObjectCandidate(row?.customFields);
  return {
    ...snake,
    ...camel,
  };
}

function extractCheckoutSnapshot(row: AnyRecord, customFields: AnyRecord): AnyRecord {
  const candidates = [
    customFields?.checkoutSnapshot,
    customFields?.checkout_snapshot,
    row?.checkoutSnapshot,
    row?.checkout_snapshot,
    row?.purchaseSnapshot,
    row?.purchase_snapshot,
    row?.custom_fields?.checkoutSnapshot,
    row?.custom_fields?.checkout_snapshot,
    row?.customFields?.checkoutSnapshot,
    row?.customFields?.checkout_snapshot,
  ];

  for (const candidate of candidates) {
    const parsed = parseObjectCandidate(candidate);
    if (Object.keys(parsed).length > 0) {
      return parsed;
    }
  }

  return {};
}

function filterProfilesByUser(rows: any[], userId?: string): any[] {
  const expectedUserId = String(userId || "").trim();
  if (!expectedUserId) {
    return rows;
  }

  return rows.filter((row: any) => {
    const owner = String(row?.user_id || row?.userId || "").trim();
    if (!owner) {
      // Keep rows when backend omits owner on /profiles/my responses.
      return true;
    }
    return owner === expectedUserId;
  });
}

function resolveAccountStatus(payload: any): string {
  const candidates = [
    payload,
    payload?.user,
    payload?.profile,
    payload?.account,
    payload?.obj,
    payload?.obj?.user,
    payload?.data,
    payload?.data?.user,
    payload?.data?.profile,
    payload?.data?.account,
  ].filter((entry) => entry && typeof entry === "object");

  for (const candidate of candidates) {
    const value = toString(
      candidate?.status ||
        candidate?.userStatus ||
        candidate?.user_status ||
        candidate?.accountStatus ||
        candidate?.account_status ||
        candidate?.state,
    ).toLowerCase();
    if (value) {
      return value;
    }
  }

  return "";
}

function isSoftDeletedStatus(status: unknown): boolean {
  const normalized = toString(status).toLowerCase();
  return (
    normalized === "deleted" ||
    normalized === "soft_deleted" ||
    normalized === "soft-deleted" ||
    normalized === "deactivated" ||
    normalized === "inactive_deleted"
  );
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return false;
  }
  if (["true", "1", "yes", "on", "enabled"].includes(text)) {
    return true;
  }
  if (["false", "0", "no", "off", "disabled", "null", "none"].includes(text)) {
    return false;
  }
  return false;
}

function normalizePushPlatform(value: unknown): "ios" | "android" | "web" {
  const platform = toString(value).toLowerCase();
  if (platform === "ios" || platform === "android" || platform === "web") {
    return platform;
  }
  return "web";
}

function normalizePushKind(value: unknown): "offers" | "orders" | "support" | "general" {
  const kind = toString(value).toLowerCase();
  if (kind === "offers" || kind === "orders" || kind === "support" || kind === "general") {
    return kind;
  }
  return "general";
}

function normalizePushAudience(value: unknown): "all" | "authenticated" | "loyalty" | "active_esim" | "admins" | "all_devices" {
  const audience = toString(value).toLowerCase();
  if (
    audience === "all" ||
    audience === "authenticated" ||
    audience === "loyalty" ||
    audience === "active_esim" ||
    audience === "admins" ||
    audience === "all_devices"
  ) {
    return audience;
  }
  return "all";
}

function parsePushAudience(value: unknown): "" | "all" | "authenticated" | "loyalty" | "active_esim" | "admins" | "all_devices" {
  const audience = toString(value).toLowerCase();
  if (
    audience === "all" ||
    audience === "authenticated" ||
    audience === "loyalty" ||
    audience === "active_esim" ||
    audience === "admins" ||
    audience === "all_devices"
  ) {
    return audience;
  }
  return "";
}

function extractAccessToken(payload: any): string {
  const direct = String(
    payload?.accessToken ||
      payload?.access_token ||
      payload?.token ||
      "",
  ).trim();
  if (direct) {
    return direct;
  }

  return String(
    payload?.auth?.accessToken ||
      payload?.auth?.access_token ||
      payload?.auth?.token ||
      payload?.data?.accessToken ||
      payload?.data?.access_token ||
      payload?.data?.token ||
      "",
  ).trim();
}

function decodeBase64Url(value: string): string {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const base64 = normalized + padding;
  try {
    if (typeof atob === "function") {
      return atob(base64);
    }
  } catch {
    // Ignore and try Buffer fallback.
  }
  try {
    return Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = String(token || "").trim().split(".");
  if (parts.length < 2) {
    return null;
  }
  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) {
    return null;
  }
  try {
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function compactString(value: unknown): string {
  return String(value ?? "").trim();
}

function buildCompositeName(first: unknown, last: unknown): string {
  const left = compactString(first);
  const right = compactString(last);
  if (left && right) {
    return `${left} ${right}`.trim();
  }
  return left || right;
}

function isPlaceholderProfileName(name: unknown): boolean {
  const normalized = compactString(name).toLowerCase();
  if (!normalized) {
    return true;
  }
  return (
    normalized === "user" ||
    normalized === "guest" ||
    normalized === "guest user" ||
    normalized === "customer" ||
    normalized === "unknown"
  );
}

function pickBestProfileName(values: unknown[], fallbackPhone = ""): string {
  for (const candidate of values) {
    const name = compactString(candidate);
    if (!isPlaceholderProfileName(name)) {
      return name;
    }
  }

  const fallback = compactString(fallbackPhone);
  if (fallback) {
    return fallback;
  }

  for (const candidate of values) {
    const name = compactString(candidate);
    if (name) {
      return name;
    }
  }

  return "";
}

function resolveAuthProfileFromToken(
  token: string,
  fallbackPhone = "",
  fallbackName = "",
): { userId: string; phone: string; name: string; subjectType?: "user" | "admin" } {
  const payload = parseJwtPayload(token) || {};
  const userId = String(
    payload.sub ??
      payload.userId ??
      payload.user_id ??
      payload.uid ??
      payload.id ??
      "",
  ).trim();
  const phone = String(
    payload.phone ??
      payload.phoneNumber ??
      payload.mobile ??
      payload.mobileNumber ??
      fallbackPhone ??
      "",
  ).trim();
  const givenName = payload.given_name ?? payload.givenName ?? payload.firstName ?? payload.first_name;
  const familyName = payload.family_name ?? payload.familyName ?? payload.lastName ?? payload.last_name;
  const compositeName = buildCompositeName(givenName, familyName);
  const name = pickBestProfileName([
    payload.name,
    payload.fullName,
    payload.full_name,
    payload.displayName,
    payload.display_name,
    payload.preferred_username,
    payload.preferredUsername,
    payload.username,
    compositeName,
    fallbackName,
  ], phone);

  return {
    userId,
    phone,
    name,
    subjectType: normalizeSubjectType(
      payload.subjectType ??
        payload.subject_type ??
        payload.role ??
        payload.roles ??
        payload.userRole ??
        payload.user_role ??
        payload.scope ??
        payload.accountType ??
        payload.account_type ??
        payload.type ??
        payload.isAdmin ??
        payload.is_admin,
    ),
  };
}

function normalizeSubjectType(raw: unknown): "user" | "admin" | undefined {
  if (typeof raw === "boolean") {
    return raw ? "admin" : "user";
  }
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const resolved = normalizeSubjectType(entry);
      if (resolved) {
        return resolved;
      }
    }
    return undefined;
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (typeof record.isAdmin === "boolean") {
      return record.isAdmin ? "admin" : "user";
    }
    if (typeof record.is_admin === "boolean") {
      return record.is_admin ? "admin" : "user";
    }
    return normalizeSubjectType(
      record.subjectType ??
        record.subject_type ??
        record.role ??
        record.name ??
        record.value ??
        record.type,
    );
  }

  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  if (value === "user" || value === "admin") {
    return value;
  }
  const normalized = value.replace(/[\s_-]+/g, " ");

  if (
    value === "super_admin" ||
    value === "super-admin" ||
    normalized === "super admin" ||
    normalized === "platform admin" ||
    normalized === "platform administrator"
  ) {
    return "admin";
  }
  if (normalized.includes("admin")) {
    return "admin";
  }
  if (normalized.includes("user") || normalized.includes("customer") || normalized.includes("client")) {
    return "user";
  }

  return undefined;
}

function normalizeStrictSubjectType(raw: unknown): "user" | "admin" | "" {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "admin" || value === "user") {
    return value;
  }
  return "";
}

function parseStrictBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "number") {
    if (raw === 1) {
      return true;
    }
    if (raw === 0) {
      return false;
    }
    return undefined;
  }
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return undefined;
}

function resolveStrictSubjectType(subjectType: unknown, isAdminValue: unknown): "user" | "admin" | "" {
  const normalizedSubjectType = normalizeStrictSubjectType(subjectType);
  const normalizedIsAdmin = parseStrictBoolean(isAdminValue);

  if (normalizedSubjectType === "admin" || normalizedIsAdmin === true) {
    return "admin";
  }
  if (normalizedSubjectType === "user" || normalizedIsAdmin === false) {
    return "user";
  }
  return "";
}

function normalizeStrictAuthIdentity(
  payload: any,
  options: { requireToken: boolean; requireRole: boolean; source: string },
): { identity?: AnyRecord; error?: string } {
  const source = String(options.source || "auth response").trim();
  const token = extractAccessToken(payload);
  if (options.requireToken && !token) {
    return {
      error: `${source} is missing accessToken.`,
    };
  }

  const accountStatus = resolveAccountStatus(payload);
  if (isSoftDeletedStatus(accountStatus)) {
    return {
      error: "This account has been deleted and cannot be used.",
    };
  }

  const subjectType = resolveStrictSubjectType(
    payload?.subjectType ?? payload?.subject_type,
    payload?.isAdmin ?? payload?.is_admin,
  );
  if (options.requireRole && !subjectType) {
    return {
      error:
        `${source} is missing role metadata. Backend must return subjectType and/or isAdmin.`,
    };
  }

  const id = toString(payload?.id);
  const adminUserId = toString(payload?.adminUserId ?? payload?.admin_user_id);
  const accountUserId = toString(payload?.userId ?? payload?.user_id);
  const canonicalId = id || adminUserId || accountUserId;
  if (!canonicalId) {
    return {
      error: `${source} is missing id.`,
    };
  }

  const parsedExpiresIn = Number(payload?.expiresIn ?? payload?.expires_in);
  const expiresIn = Number.isFinite(parsedExpiresIn) ? parsedExpiresIn : undefined;
  const tokenType = toString(payload?.tokenType ?? payload?.token_type);
  const phone = toString(payload?.phone);
  const name = toString(payload?.name);
  const email = toString(payload?.email);
  const role = toString(payload?.role);
  const permissions =
    payload?.permissions && typeof payload.permissions === "object"
      ? payload.permissions
      : undefined;

  const isAdmin =
    subjectType === "admin"
      ? true
      : subjectType === "user"
      ? false
      : parseStrictBoolean(payload?.isAdmin ?? payload?.is_admin) === true;

  return {
    identity: {
      token,
      tokenType: tokenType || undefined,
      expiresIn,
      id: canonicalId,
      userId: canonicalId,
      adminUserId: adminUserId || undefined,
      accountUserId: accountUserId || undefined,
      phone: phone || undefined,
      name: name || undefined,
      email: email || undefined,
      role: role || undefined,
      permissions,
      subjectType: subjectType || undefined,
      isAdmin,
      status: accountStatus || undefined,
    },
  };
}

function resolveAuthProfile(
  payload: any,
  fallbackPhone = "",
  fallbackName = "",
): { userId: string; phone: string; name: string; subjectType?: "user" | "admin" } {
  const candidates = [
    payload,
    payload?.user,
    payload?.profile,
    payload?.account,
    payload?.obj,
    payload?.obj?.user,
    payload?.data,
    payload?.data?.user,
    payload?.data?.profile,
  ].filter((entry) => entry && typeof entry === "object");

  for (const candidate of candidates) {
    const userId = String(
      candidate?.userId ||
        candidate?.id ||
        candidate?.uid ||
        candidate?.user_id ||
        candidate?.sub ||
        candidate?.uuid ||
        "",
    ).trim();
    if (!userId) {
      continue;
    }

    const phone = String(
      candidate?.phone ||
        candidate?.phoneNumber ||
        candidate?.mobile ||
        candidate?.mobileNumber ||
        candidate?.userPhone ||
        fallbackPhone ||
        "",
    ).trim();
    const compositeName = buildCompositeName(
      candidate?.firstName ?? candidate?.first_name ?? candidate?.givenName ?? candidate?.given_name,
      candidate?.lastName ?? candidate?.last_name ?? candidate?.familyName ?? candidate?.family_name,
    );

    return {
      userId,
      phone,
      name: pickBestProfileName([
        candidate?.name,
        candidate?.fullName,
        candidate?.full_name,
        candidate?.displayName,
        candidate?.display_name,
        candidate?.adminName,
        candidate?.admin_name,
        candidate?.username,
        candidate?.userName,
        compositeName,
        fallbackName,
      ], phone),
      subjectType: normalizeSubjectType(
        candidate?.subjectType ||
          candidate?.subject_type ||
          candidate?.role ||
          candidate?.roles ||
          candidate?.userRole ||
          candidate?.user_role ||
          candidate?.scope ||
          candidate?.accountType ||
          candidate?.account_type ||
          candidate?.type ||
          candidate?.isAdmin ||
          candidate?.is_admin,
      ),
    };
  }

  return {
    userId: "",
    phone: String(fallbackPhone || "").trim(),
    name: pickBestProfileName([fallbackName], fallbackPhone),
    subjectType: undefined,
  };
}

function getCurrentTimezoneName(): string {
  try {
    return String(Intl.DateTimeFormat().resolvedOptions().timeZone || "").trim();
  } catch {
    return "";
  }
}

function shouldFallbackToLegacyPushRoute(response: ApiResponse | null | undefined): boolean {
  const message = String(response?.error || "").trim().toLowerCase();
  if (!message) {
    return false;
  }
  return (
    message.includes("status 404") ||
    message.includes("status 405") ||
    message.includes("status 500") ||
    message.includes("status 502") ||
    message.includes("status 503") ||
    message.includes("status 504") ||
    message.includes("not found")
  );
}

function shouldTryAlternateSignupRoute(response: ApiResponse | null | undefined): boolean {
  const message = String(response?.error || "").trim().toLowerCase();
  if (!message) {
    return false;
  }
  return (
    message.includes("status 404") ||
    message.includes("status 405") ||
    message.includes("status 401") ||
    message.includes("status 403") ||
    message.includes("not found") ||
    message.includes("method not allowed") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  );
}

function isMissingRouteError(response: ApiResponse | null | undefined): boolean {
  const message = String(response?.error || "").trim().toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes("status 404") ||
    message.includes("status 405") ||
    message.includes("not found") ||
    message.includes("method not allowed") ||
    message.includes("cannot get")
  );
}

async function syncPushDeviceLegacy(payload: {
  installId: string;
  token?: string;
  userId?: string;
  platform?: string;
  locale?: string;
  appVersion?: string;
  notificationsEnabled?: boolean;
  supportChatOpen?: boolean;
  supportChatSeenAt?: string;
}): Promise<ApiResponse> {
  const primary = await requestApi("/push/devices/sync", {
    method: "POST",
    body: payload,
    includeAuth: false,
  });

  if (primary.success) {
    return primary;
  }

  return requestApi("/api/esim-app/push/devices/sync", {
    method: "POST",
    body: payload,
    includeAuth: false,
    baseCandidates: getApiOriginCandidates(),
  });
}

async function unregisterPushDeviceLegacy(payload: {
  installId: string;
  token?: string;
  userId?: string;
  platform?: string;
}): Promise<ApiResponse> {
  const primary = await requestApi("/push/devices/unregister", {
    method: "POST",
    body: payload,
    includeAuth: false,
  });

  if (primary.success) {
    return primary;
  }

  return requestApi("/api/esim-app/push/devices/unregister", {
    method: "POST",
    body: payload,
    includeAuth: false,
    baseCandidates: getApiOriginCandidates(),
  });
}

function normalizePriceUsd(raw: unknown): number {
  const value = toNumber(raw, 0);
  if (value <= 0) {
    return 0;
  }

  // Provider prices arrive as scaled integers (e.g. 8500 => 0.85 USD, 132000 => 13.2 USD).
  // Keep already-decimal prices unchanged.
  if (Number.isInteger(value) && value >= 100) {
    return value / 10000;
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
      row?.duration,
    0,
  );

  if (direct > 0) {
    const unit = toString(row?.durationUnit ?? row?.duration_unit).toUpperCase();
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

  const slug = toString(row?.slug).toUpperCase();
  const tailMatch = slug.match(/_(\d{1,4})$/);
  if (tailMatch) {
    const inferred = Number.parseInt(tailMatch[1], 10);
    if (Number.isFinite(inferred) && inferred > 0) {
      return inferred;
    }
  }

  return 0;
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

  if (import.meta.env.DEV) {
    console.debug("[normalizeDataGb] raw:", raw, "→ numeric:", value);
  }

  // Bytes range: anything >= 1 million is almost certainly bytes.
  if (value >= 1_000_000) {
    const gb = value / BYTES_PER_GB;
    if (import.meta.env.DEV) console.debug("[normalizeDataGb] → bytes →", gb, "GB");
    return gb;
  }

  // MB range: values > 100 are likely MB (GB plans rarely exceed 100 GB).
  if (value > 100) {
    const gb = value / 1024;
    if (import.meta.env.DEV) console.debug("[normalizeDataGb] → MB →", gb, "GB");
    return gb;
  }

  // Small values (0–100) are treated as GB directly.
  return value;
}

function isPerDayOffer(row: any): boolean {
  const mode = toString(row?.allowanceMode ?? row?.allowance_mode).toLowerCase();
  if (mode === "per_day" || mode === "perday" || mode === "daily") {
    return true;
  }

  if (
    parseBoolean(row?.isPerDay) ||
    parseBoolean(row?.perDay) ||
    parseBoolean(row?.daily) ||
    parseBoolean(row?.dataPerDay) ||
    parseBoolean(row?.is_daily)
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

function pickPackageList(data: any): any[] {
  if (Array.isArray(data?.packageList)) {
    return data.packageList;
  }
  if (Array.isArray(data?.obj?.packageList)) {
    return data.obj.packageList;
  }
  return [];
}

function toUnixMs(value: unknown): number {
  const text = toString(value);
  if (!text) {
    return 0;
  }
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : 0;
}

function compareFeaturedRows(a: any, b: any): number {
  const aUpdated = toUnixMs(a?.updatedAt ?? a?.updated_at);
  const bUpdated = toUnixMs(b?.updatedAt ?? b?.updated_at);
  if (aUpdated !== bUpdated) {
    return bUpdated - aUpdated;
  }

  const aCreated = toUnixMs(a?.createdAt ?? a?.created_at);
  const bCreated = toUnixMs(b?.createdAt ?? b?.created_at);
  if (aCreated !== bCreated) {
    return bCreated - aCreated;
  }

  const aId = toNumber(a?.id, 0);
  const bId = toNumber(b?.id, 0);
  return bId - aId;
}

function getLatestFeaturedRows(rows: any[]): any[] {
  const latestByCode = new Map<string, any>();
  for (const row of rows || []) {
    const code = toString(row?.code).toUpperCase();
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
  const normalizedCode = toString(code).toUpperCase();
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

  const data = unwrapApiData(response) || response;
  const rows = pickPackageList(data);
  const nonDailyOffers = rows.filter((row) => !isPerDayOffer(row));
  const pricedOffers = nonDailyOffers
    .map((row) => pickFirstPositivePrice([row?.price]))
    .filter((value) => value > 0);

  const metrics = {
    priceFrom: pricedOffers.length > 0 ? Math.min(...pricedOffers) : 0,
    plansCount: nonDailyOffers.length,
  };

  popularMetricsCache.set(normalizedCode, { value: metrics, expiresAt: now + POPULAR_METRICS_CACHE_TTL_MS });
  return metrics;
}

async function listUsersRaw(): Promise<any[]> {
  const response = await requestApi("/admin/users");
  if (!response.success) {
    return [];
  }
  const data = unwrapApiData(response) || response;
  if (Array.isArray(data?.users)) {
    return data.users;
  }
  if (Array.isArray(data?.rows)) {
    return data.rows;
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

function getCandidateUserIds(row: any): string[] {
  const candidates = [
    row?.id,
    row?.userId,
    row?.user_id,
    row?._id,
    row?.uuid,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

async function upsertUserById(
  userId: string,
  updates: {
    status?: string;
    isLoyalty?: boolean;
    name?: string;
    phone?: string;
  },
): Promise<ApiResponse> {
  const users = await listUsersRaw();
  const requestedUserId = String(userId || "").trim();
  const target = users.find((row: any) => getCandidateUserIds(row).includes(requestedUserId));
  if (!target) {
    return { success: false, error: "User not found." };
  }

  const payload: AnyRecord = {
    phone: normalizePhone(updates.phone ?? target.phone),
    name: normalizeName(updates.name ?? target.name),
    email: String(target.email || "").trim() || undefined,
    status: String(updates.status || target.status || "active"),
    isLoyalty:
      typeof updates.isLoyalty === "boolean"
        ? updates.isLoyalty
        : Boolean(target.is_loyalty ?? target.isLoyalty ?? false),
    notes: String(target.notes || "").trim() || undefined,
  };

  return requestApi("/admin/users", {
    method: "POST",
    body: payload,
  });
}

export function signup(payload: { phone: string; name: string; password?: string }): Promise<ApiResponse> {
  return (async () => {
    const normalizedPhone = normalizePhone(payload.phone);
    const normalizedName = normalizeName(payload.name);
    const password = String(payload.password || "").trim();
    const body = {
      phone: normalizedPhone,
      name: normalizedName,
      ...(password ? { password } : {}),
    };

    const publicSignupPaths = ["/auth/user/signup", "/auth/user/register", "/auth/signup", "/signup"];
    let lastError = "Signup failed";

    for (const path of publicSignupPaths) {
      const response = await requestApi(path, {
        method: "POST",
        body,
        includeAuth: false,
        timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
      });

      if (response.success) {
        const data = unwrapApiData(response) || response;
        const token = extractAccessToken(response) || extractAccessToken(data);
        let accountStatus = resolveAccountStatus(data);
        let profile = resolveAuthProfile(data, normalizedPhone, normalizedName);
        if (token) {
          const tokenProfile = resolveAuthProfileFromToken(token, normalizedPhone, normalizedName);
          profile = {
            userId: profile.userId || tokenProfile.userId,
            phone: profile.phone || tokenProfile.phone || normalizedPhone,
            name: pickBestProfileName([profile.name, tokenProfile.name, normalizedName], normalizedPhone),
            subjectType: profile.subjectType || tokenProfile.subjectType,
          };
        }

        if (!profile.userId && token) {
          const me = await requestApi("/auth/me", {
            includeAuth: false,
            headers: { Authorization: `Bearer ${token}` },
            timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
          });

          if (me.success) {
            const meData = unwrapApiData(me) || me;
            accountStatus = resolveAccountStatus(meData) || accountStatus;
            const meProfile = resolveAuthProfile(meData, normalizedPhone, normalizedName);
            profile = {
              userId: meProfile.userId || profile.userId,
              phone: meProfile.phone || profile.phone || normalizedPhone,
              name: pickBestProfileName([meProfile.name, profile.name, normalizedName], normalizedPhone),
              subjectType: meProfile.subjectType || profile.subjectType,
            };
          }
        }

        if (isSoftDeletedStatus(accountStatus)) {
          return {
            success: false,
            error: "This account has been deleted and cannot be used.",
          } as ApiResponse;
        }

        return {
          success: true,
          data: {
            ...data,
            token: token || undefined,
            userId: profile.userId || undefined,
            phone: profile.phone || normalizedPhone || "",
            name: pickBestProfileName([profile.name, normalizedName], normalizedPhone),
            subjectType: profile.subjectType,
            status: accountStatus || undefined,
          },
        } as ApiResponse;
      }

      lastError = String(response.error || lastError || "Signup failed");
      if (!shouldTryAlternateSignupRoute(response)) {
        return response;
      }
    }

    return {
      success: false,
      error:
        "Signup is not available on this backend yet. Please add a public user-signup endpoint. "
        + `(Last response: ${lastError})`,
    };
  })();
}

export function login(payload: { phone: string; password?: string }): Promise<ApiResponse> {
  return (async () => {
    const loginPaths = ["/auth/admin/login", "/auth/user/login"];
    let lastError = "Login failed";

    for (const path of loginPaths) {
      const response = await requestApi(path, {
        method: "POST",
        body: {
          phone: payload.phone,
          password: String(payload.password || ""),
        },
        includeAuth: false,
        timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
      });

      if (!response.success) {
        lastError = String(response.error || lastError || "Login failed");
        continue;
      }

      const data = unwrapApiData(response) || response;
      const token = extractAccessToken(response) || extractAccessToken(data);
      const normalized = normalizeStrictAuthIdentity(
        {
          ...(data && typeof data === "object" ? data : {}),
          accessToken: token || undefined,
        },
        {
          requireToken: true,
          requireRole: true,
          source: `login response (${path})`,
        },
      );

      if (!normalized.identity) {
        lastError = String(normalized.error || lastError || "Login failed");
        continue;
      }

      const identity = normalized.identity;
      return {
        success: true,
        data: {
          ...identity,
          phone: identity.phone || normalizePhone(payload.phone),
          name: identity.name || normalizePhone(payload.phone),
        },
      } as ApiResponse;
    }

    return {
      success: false,
      error: lastError,
    } as ApiResponse;
  })();
}

export function getAuthMeIdentity(tokenOverride?: string): Promise<ApiResponse> {
  return (async () => {
    const bearer = toString(tokenOverride);
    const response = await requestApi("/auth/me", {
      includeAuth: bearer ? false : true,
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
      timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
    });
    if (!response.success) {
      return response;
    }

    const data = unwrapApiData(response) || response;
    const normalized = normalizeStrictAuthIdentity(
      {
        ...(data && typeof data === "object" ? data : {}),
        accessToken: bearer || extractAccessToken(response) || extractAccessToken(data) || undefined,
      },
      {
        requireToken: false,
        requireRole: true,
        source: "/auth/me response",
      },
    );

    if (!normalized.identity) {
      return {
        success: false,
        error: normalized.error || "Invalid /auth/me response.",
      };
    }

    return {
      success: true,
      data: normalized.identity,
    } as ApiResponse;
  })();
}

export function updateAuthMeProfile(payload: { name?: string; email?: string | null }): Promise<ApiResponse> {
  return (async () => {
    const nextPayload: AnyRecord = {};

    if (payload?.name !== undefined) {
      const trimmedName = normalizeName(payload?.name);
      if (trimmedName.length < 2) {
        return {
          success: false,
          error: "Name must be at least 2 characters.",
          statusCode: 422,
        };
      }
      nextPayload.name = trimmedName;
    }

    if (payload?.email !== undefined) {
      const rawEmail = payload.email;
      const trimmedEmail = toString(rawEmail).trim().toLowerCase();
      nextPayload.email = rawEmail === null || trimmedEmail === "" ? null : trimmedEmail;
    }

    if (Object.keys(nextPayload).length === 0) {
      return {
        success: false,
        error: "No profile changes to save.",
        statusCode: 422,
      };
    }

    return requestApi("/auth/me", {
      method: "PATCH",
      body: nextPayload,
      timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
    });
  })();
}

export function checkSuperAdmin(phoneNumber: string): Promise<ApiResponse> {
  return (async () => {
    const response = await listSuperAdmins("");
    if (!response.success) {
      return response;
    }
    const admins = Array.isArray(response.data) ? response.data : [];
    const normalized = normalizePhone(phoneNumber);
    const isSuperAdmin = admins.some(
      (entry: any) =>
        normalizePhone(String(entry?.phone || "")) === normalized &&
        String(entry?.status || "active").trim().toLowerCase() === "active",
    );
    return { success: true, data: { isSuperAdmin } };
  })();
}

export function listSuperAdmins(_adminPhone: string): Promise<ApiResponse> {
  return (async () => {
    const response = await requestApi("/admin/admin-users");
    if (!response.success) {
      return response;
    }
    const data = unwrapApiData(response) || response;
    const rows = Array.isArray(data?.adminUsers) ? data.adminUsers : [];
    return { success: true, data: rows };
  })();
}

export function addSuperAdmin(_adminPhone: string, phoneNumber: string): Promise<ApiResponse> {
  return requestApi("/admin/admin-users", {
    method: "POST",
    body: {
      phone: normalizePhone(phoneNumber),
      name: "Admin User",
      status: "active",
      role: "admin",
      canManageUsers: true,
      canManageOrders: true,
      canManagePricing: true,
      canManageContent: true,
      canSendPush: true,
    },
  });
}

export function removeSuperAdmin(_adminPhone: string, phoneNumber: string): Promise<ApiResponse> {
  return (async () => {
    const list = await listSuperAdmins("");
    if (!list.success) {
      return list;
    }
    const rows = Array.isArray(list.data) ? list.data : [];
    const target = rows.find(
      (entry: any) => normalizePhone(String(entry?.phone || "")) === normalizePhone(phoneNumber),
    );
    if (!target) {
      return { success: true, data: { removed: false } };
    }

    return requestApi("/admin/admin-users", {
      method: "POST",
      body: {
        phone: normalizePhone(target.phone),
        name: normalizeName(target.name),
        status: "blocked",
        role: String(target.role || "admin"),
        canManageUsers: Boolean(target.can_manage_users ?? target.canManageUsers ?? false),
        canManageOrders: Boolean(target.can_manage_orders ?? target.canManageOrders ?? false),
        canManagePricing: Boolean(target.can_manage_pricing ?? target.canManagePricing ?? false),
        canManageContent: Boolean(target.can_manage_content ?? target.canManageContent ?? false),
        canSendPush: false,
      },
    });
  })();
}

export function listUsers(
  _adminPhone: string,
  options?: { includeDeleted?: boolean },
): Promise<ApiResponse> {
  return (async () => {
    const response = await requestApi("/admin/users", {
      query: options?.includeDeleted ? { includeDeleted: true } : undefined,
    });
    if (!response.success) {
      return response;
    }

    const data = unwrapApiData(response) || response;
    if (Array.isArray(data?.users)) {
      return { success: true, data: data.users } as ApiResponse;
    }
    if (Array.isArray(data?.rows)) {
      return { success: true, data: data.rows } as ApiResponse;
    }
    if (Array.isArray(data?.items)) {
      return { success: true, data: data.items } as ApiResponse;
    }
    if (Array.isArray(data)) {
      return { success: true, data } as ApiResponse;
    }

    return { success: true, data: [] } as ApiResponse;
  })();
}

export function deleteUser(userId: string, _adminPhone: string): Promise<ApiResponse> {
  return (async () => {
    const targetUserId = toString(userId);
    if (!targetUserId) {
      return { success: false, error: "User id is required." };
    }
    const response = await requestApi(`/admin/users/${encodeURIComponent(targetUserId)}`, {
      method: "DELETE",
    });
    if (!response.success) {
      return response;
    }

    const data = unwrapApiData(response) || response.data || {};
    return {
      success: true,
      data: {
        deleted: Boolean(data?.deleted ?? true),
        id: toString(data?.id || data?.userId || targetUserId),
        userId: toString(data?.userId || data?.id || targetUserId),
        status: toString(data?.status || "deleted") || "deleted",
        deletedAt: toString(data?.deletedAt || data?.deleted_at || ""),
      },
    } as ApiResponse;
  })();
}

export function deleteCurrentUser(payload?: { userId?: string; phone?: string; email?: string }): Promise<ApiResponse> {
  return (async () => {
    void payload;
    const response = await requestApi("/auth/me", { method: "DELETE" });
    if (!response.success) {
      return response;
    }

    const data = unwrapApiData(response) || response.data || {};
    return {
      success: true,
      data: {
        deleted: Boolean(data?.deleted ?? true),
        status: toString(data?.status || "deleted") || "deleted",
        deletedAt: toString(data?.deletedAt || data?.deleted_at || ""),
        subjectType: normalizeStrictSubjectType(data?.subjectType || data?.subject_type),
      },
    } as ApiResponse;
  })();
}

export function setUserBlocked(payload: {
  adminPhone: string;
  userId: string;
  blocked: boolean;
}): Promise<ApiResponse> {
  return upsertUserById(payload.userId, { status: payload.blocked ? "blocked" : "active" });
}

export function grantLoyalty(payload: {
  adminPhone: string;
  userId: string;
  granted: boolean;
}): Promise<ApiResponse> {
  return upsertUserById(payload.userId, { isLoyalty: Boolean(payload.granted) });
}

export function editUser(payload: {
  adminPhone: string;
  userId: string;
  name?: string;
  phone?: string;
}): Promise<ApiResponse> {
  const nextName = toString(payload?.name);
  const nextPhone = toString(payload?.phone);
  if (!nextName && !nextPhone) {
    return Promise.resolve({ success: false, error: "Name or phone is required." });
  }

  return upsertUserById(payload.userId, {
    ...(nextName ? { name: nextName } : {}),
    ...(nextPhone ? { phone: nextPhone } : {}),
  });
}

export function getLoyaltyStatus(userId?: string): Promise<ApiResponse> {
  return (async () => {
    const authMe = await requestApi("/auth/me");
    if (!authMe.success) {
      return authMe;
    }

    const data = unwrapApiData(authMe) || authMe;
    const accountStatus = resolveAccountStatus(data);
    if (isSoftDeletedStatus(accountStatus)) {
      return {
        success: false,
        error: "Account is deleted and inactive.",
      };
    }
    return {
      success: true,
      data: {
        hasAccess: Boolean(data?.isLoyalty),
        userId: String(data?.id || userId || ""),
      },
    } as ApiResponse;
  })();
}

export function getDestinations(): Promise<ApiResponse> {
  return (async () => {
    const response = await requestApi("/esim-access/locations/query", {
      method: "POST",
      body: {},
      includeAuth: false,
    });
    if (!response.success) {
      return response;
    }

    const data = unwrapApiData(response);
    const flat = flattenLocations(Array.isArray(data?.locationList) ? data.locationList : []);
    const mapped = flat
      .map((row: any) => {
        const code = String(row?.code || "").trim().toUpperCase();
        const type = Number(row?.type);
        const name = String(row?.name || code || "Unknown").trim();
        if (!code || !name) {
          return null;
        }

        const isCountryLike = code.length === 2 || type === 1;
        return {
          id: code || name,
          code,
          iso: code,
          name,
          flag: isCountryLike ? countryFlag(code) : "🌍",
          type: isCountryLike ? "country" : "regional",
        };
      })
      .filter(Boolean);

    const byCode = new Map<string, any>();
    mapped.forEach((row: any) => {
      const code = String(row?.code || "").trim().toUpperCase();
      if (!code) {
        return;
      }
      if (!byCode.has(code)) {
        byCode.set(code, row);
      }
    });

    return { success: true, data: Array.from(byCode.values()) } as ApiResponse;
  })();
}

export function getAdminFeaturedLocationCodes(): Promise<ApiResponse> {
  return (async () => {
    const featured = await requestApi("/admin/featured-locations");
    if (!featured.success) {
      return featured;
    }

    const data = unwrapApiData(featured) || featured;
    const rows = Array.isArray(data?.locations)
      ? data.locations
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data)
      ? data
      : [];

    const latestRows = getLatestFeaturedRows(rows);
    const codes = latestRows
      .filter((row: any) => {
        const isPopular = parseBoolean(row?.isPopular ?? row?.is_popular ?? true);
        const enabled = parseBoolean(row?.enabled ?? true);
        return isPopular && enabled;
      })
      .map((row: any) => String(row?.code || "").trim().toUpperCase())
      .filter((code: string) => code.length > 0);

    return { success: true, data: Array.from(new Set(codes)) } as ApiResponse;
  })();
}

export function getPopularDestinations(): Promise<ApiResponse> {
  return (async () => {
    const candidates = [
      "/esim-access/featured-locations",
      "/featured-locations/public",
      "/admin/featured-locations",
    ];

    let featured: ApiResponse | null = null;
    for (const path of candidates) {
      const response = await requestApi(path, {
        includeAuth: path === "/admin/featured-locations",
      });
      if (response.success) {
        featured = response;
        break;
      }
      featured = response;
    }

    if (!featured?.success) {
      return featured || { success: false, error: "Unable to load popular destinations" };
    }

    const data = unwrapApiData(featured) || featured;
    const rows = Array.isArray(data?.locations)
      ? data.locations
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data)
      ? data
      : [];
    const latestRows = getLatestFeaturedRows(rows);
    const activePopularRows = latestRows.filter((row: any) => {
      const isPopular = parseBoolean(row?.isPopular ?? row?.is_popular ?? true);
      const enabled = parseBoolean(row?.enabled ?? true);
      return isPopular && enabled;
    });
    const rowsWithMetrics = await Promise.all(
      activePopularRows.map(async (row: any) => {
        const code = String(row?.code || "").trim().toUpperCase();
        const metrics = await fetchPopularLocationMetrics(code);
        return { row, code, metrics };
      }),
    );

    return {
      success: true,
      data: rowsWithMetrics
        .filter(({ code, metrics }) => code.length === 2 && metrics.priceFrom > 0 && metrics.plansCount > 1)
        .map(({ row, code, metrics }) => {
        return {
          id: row?.id || code,
          code,
          iso: code,
          name: String(row?.name || code || "Unknown"),
          flag: countryFlag(code),
          type: "country",
          priceFrom: metrics.priceFrom,
          plansCount: metrics.plansCount,
          plans: metrics.plansCount,
          status: String(row?.status || "active"),
        };
      }),
    } as ApiResponse;
  })();
}

export function setPopularDestinations(countryCodes: string[]): Promise<ApiResponse> {
  return (async () => {
    const normalized = countryCodes
      .map((code) => String(code || "").trim().toUpperCase())
      .filter((code) => code.length === 2);

    for (let index = 0; index < normalized.length; index += 1) {
      const code = normalized[index];
      const response = await requestApi("/admin/featured-locations", {
        method: "POST",
        body: {
          code,
          name: code,
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

    return { success: true, data: { saved: normalized.length } };
  })();
}

export function clearPopularDestinations(): Promise<ApiResponse> {
  return (async () => {
    const featured = await requestApi("/admin/featured-locations");
    if (!featured.success) {
      return featured;
    }

    const data = unwrapApiData(featured) || featured;
    const rows = Array.isArray(data?.locations) ? data.locations : [];
    const latestRows = getLatestFeaturedRows(rows);
    const activePopularRows = latestRows.filter((row: any) => {
      const isPopular = parseBoolean(row?.isPopular ?? row?.is_popular ?? true);
      const enabled = parseBoolean(row?.enabled ?? true);
      return isPopular && enabled;
    });

    for (const row of activePopularRows) {
      const response = await requestApi("/admin/featured-locations", {
        method: "POST",
        body: {
          code: String(row?.code || "").trim().toUpperCase(),
          name: String(row?.name || row?.code || "").trim().toUpperCase(),
          serviceType: String(row?.serviceType ?? row?.service_type ?? "esim"),
          locationType: String(row?.locationType ?? row?.location_type ?? "country"),
          badgeText: row?.badgeText ?? row?.badge_text ?? null,
          sortOrder: Number(row?.sortOrder ?? row?.sort_order ?? 0),
          isPopular: false,
          enabled: false,
          startsAt: row?.startsAt ?? row?.starts_at ?? null,
          endsAt: row?.endsAt ?? row?.ends_at ?? null,
          customFields: row?.customFields ?? row?.custom_fields ?? {},
        },
      });
      if (!response.success) {
        return response;
      }
    }

    return {
      success: true,
      data: {
        cleared: activePopularRows.length,
      },
    } as ApiResponse;
  })();
}

export function getCountryPlans(countryCode: string): Promise<ApiResponse> {
  return (async () => {
    const response = await requestApi("/esim-access/packages/query", {
      method: "POST",
      body: {
        locationCode: String(countryCode || "").trim().toUpperCase(),
      },
      includeAuth: false,
    });
    if (!response.success) {
      return response;
    }

    const data = unwrapApiData(response);
    const rows = pickPackageList(data);
    return {
      success: true,
      data: rows.map((row: any, index: number) => ({
        id: row?.packageCode || row?.slug || `plan-${index + 1}`,
        bundleName: row?.packageCode || row?.slug || "",
        name: row?.name || row?.slug || "Plan",
        data: normalizeDataGb(row?.data ?? row?.dataGB ?? row?.volume),
        validity: normalizeValidityDays(row),
        price: pickFirstPositivePrice([row?.price]),
        currencyCode: row?.currencyCode || "USD",
        speed: row?.speed || "",
        location: row?.location || "",
        locationCode: row?.locationCode || row?.location_code || "",
        locationNetworkList: Array.isArray(row?.locationNetworkList) ? row.locationNetworkList : [],
        durationUnit: row?.durationUnit || row?.duration_unit || "",
        slug: row?.slug || "",
        description: row?.description || "",
        dataType: row?.dataType,
        supportTopUpType: row?.supportTopUpType,
        fupPolicy: row?.fupPolicy || "",
        allowanceMode: isPerDayOffer(row) ? "per_day" : "fixed",
        unlimited: parseBoolean(row?.unlimited),
      })),
    } as ApiResponse;
  })();
}

export function getRegionPlans(regionCode: string): Promise<ApiResponse> {
  return getCountryPlans(regionCode);
}

export function getCurrencySettings(): Promise<ApiResponse> {
  if (!isBackendCapabilityEnabled("currencySettings")) {
    return Promise.resolve(unsupported("Currency settings"));
  }
  return (async () => {
    const fromCurrent = await requestApi("/esim-access/exchange-rates/current");
    if (fromCurrent.success) {
      const current = unwrapApiData(fromCurrent) || fromCurrent || {};
      const currentCustom = current?.customFields ?? current?.custom_fields;
      const custom = currentCustom && typeof currentCustom === "object" ? currentCustom : {};
      return {
        success: true,
        data: {
          enableIQD: parseBoolean(
            current?.enableIQD ??
              current?.enable_iqd ??
              custom?.enableIQD ??
              custom?.enable_iqd ??
              current?.active,
          ),
          exchangeRate: String(toNumber(current?.exchangeRate ?? current?.exchange_rate ?? current?.rate, 1320)),
          markupPercent: String(
            toNumber(
              current?.markupPercent ??
                current?.markup_percent ??
                custom?.markupPercent ??
                custom?.markup_percent,
              0,
            ),
          ),
        },
      } as ApiResponse;
    }

    const fallbackAllowed = shouldFallbackToLegacyPushRoute({ success: false, error: String(fromCurrent.error || "") });
    if (!fallbackAllowed) {
      return {
        success: true,
        data: {
          enableIQD: false,
          exchangeRate: "1320",
          markupPercent: "0",
        },
      } as ApiResponse;
    }

    const response = await requestApi("/admin/exchange-rates");
    if (!response.success) {
      return {
        success: true,
        data: {
          enableIQD: false,
          exchangeRate: "1320",
          markupPercent: "0",
        },
      } as ApiResponse;
    }

    const data = unwrapApiData(response) || response;
    const rows = Array.isArray(data?.exchangeRates)
      ? data.exchangeRates
      : Array.isArray(data?.rates)
      ? data.rates
      : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
      ? data
      : [];
    const usdIqdRows = rows.filter(
      (row: any) =>
        toString(row?.baseCurrency ?? row?.base_currency).toUpperCase() === "USD" &&
        toString(row?.quoteCurrency ?? row?.quote_currency).toUpperCase() === "IQD",
    );

    const sorted = [...usdIqdRows].sort((a: any, b: any) => {
      const aTime = Date.parse(toString(a?.effectiveAt || a?.createdAt || ""));
      const bTime = Date.parse(toString(b?.effectiveAt || b?.createdAt || ""));
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });

    const preferred = sorted.find((row: any) => parseBoolean(row?.active)) || sorted[0];
    const customCandidate = preferred?.customFields ?? preferred?.custom_fields;
    const custom = customCandidate && typeof customCandidate === "object" ? customCandidate : {};

    return {
      success: true,
      data: {
        enableIQD: parseBoolean(
          custom?.enableIQD ??
            custom?.enable_iqd ??
            preferred?.enableIQD ??
            preferred?.enable_iqd ??
            preferred?.active,
        ),
        exchangeRate: String(toNumber(preferred?.rate ?? preferred?.exchangeRate ?? preferred?.exchange_rate, 1320)),
        markupPercent: String(
          toNumber(
            custom?.markupPercent ??
              custom?.markup_percent ??
              preferred?.markupPercent ??
              preferred?.markup_percent,
            0,
          ),
        ),
      },
    } as ApiResponse;
  })();
}

export function updateCurrencySettings(payload: {
  enableIQD: boolean;
  exchangeRate: string;
  markupPercent: string;
}): Promise<ApiResponse> {
  if (!isBackendCapabilityEnabled("currencySettings")) {
    return Promise.resolve(unsupported("Currency settings"));
  }
  return requestApi("/admin/exchange-rates", {
    method: "POST",
    body: {
      baseCurrency: "USD",
      quoteCurrency: "IQD",
      rate: toNumber(payload.exchangeRate, 1320),
      source: "tulip-admin",
      active: true,
      customFields: {
        enableIQD: Boolean(payload.enableIQD),
        markupPercent: String(toNumber(payload.markupPercent, 0)),
      },
    },
  });
}

const WHITELIST_SETTINGS_PATHS = [
  "/admin/whitelist-settings",
  "/admin/settings/whitelist",
  "/admin/whitelist-countries",
  "/admin/whitelist",
] as const;

function normalizeWhitelistCodes(value: unknown): string[] {
  const fromList = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(",")
    : [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  fromList.forEach((entry) => {
    const code = toString(entry).toUpperCase();
    if (!code || seen.has(code)) {
      return;
    }
    seen.add(code);
    normalized.push(code);
  });

  return normalized;
}

function normalizeWhitelistSettingsPayload(raw: unknown): { enabled: boolean; codes: string[] } {
  const data = raw && typeof raw === "object" ? raw as AnyRecord : {};
  const candidateCodes =
    data?.codes ??
    data?.countryCodes ??
    data?.country_codes ??
    data?.allowedCountries ??
    data?.allowed_countries ??
    data?.whitelistCodes ??
    data?.whitelist_codes ??
    data?.customFields?.codes ??
    data?.custom_fields?.codes ??
    [];
  const codes = normalizeWhitelistCodes(candidateCodes);
  const enabled = parseBoolean(
    data?.enabled ??
      data?.isEnabled ??
      data?.is_enabled ??
      data?.whitelistEnabled ??
      data?.whitelist_enabled ??
      (codes.length > 0),
  );

  return { enabled, codes };
}

export function getWhitelistSettings(): Promise<ApiResponse> {
  if (!isBackendCapabilityEnabled("whitelistSettings")) {
    return Promise.resolve(unsupported("Whitelist settings"));
  }
  return (async () => {
    let lastFailure: ApiResponse | null = null;

    for (const path of WHITELIST_SETTINGS_PATHS) {
      const response = await requestApi(path);
      if (response.success) {
        const data = unwrapApiData(response) ?? response.data ?? {};
        return {
          success: true,
          data: normalizeWhitelistSettingsPayload(data),
        } as ApiResponse;
      }

      if (isMissingRouteError(response)) {
        lastFailure = response;
        continue;
      }
      return response;
    }

    return lastFailure || unsupported("Whitelist settings");
  })();
}

export function updateWhitelistSettings(payload: {
  enabled: boolean;
  codes: string[];
}): Promise<ApiResponse> {
  if (!isBackendCapabilityEnabled("whitelistSettings")) {
    return Promise.resolve(unsupported("Whitelist settings"));
  }
  return (async () => {
    const codes = normalizeWhitelistCodes(payload?.codes || []);
    const enabled = Boolean(payload?.enabled);
    const body = {
      enabled,
      isEnabled: enabled,
      codes,
      countryCodes: codes,
      whitelistCodes: codes,
      customFields: {
        enabled,
        codes,
      },
    };

    let lastFailure: ApiResponse | null = null;

    for (const path of WHITELIST_SETTINGS_PATHS) {
      const response = await requestApi(path, {
        method: "POST",
        body,
      });
      if (response.success) {
        const data = unwrapApiData(response) ?? response.data ?? body;
        return {
          success: true,
          data: normalizeWhitelistSettingsPayload(data),
        } as ApiResponse;
      }

      if (isMissingRouteError(response)) {
        lastFailure = response;
        continue;
      }
      return response;
    }

    return lastFailure || unsupported("Whitelist settings");
  })();
}

export function syncPushDevice(payload: {
  installId: string;
  token?: string;
  userId?: string;
  accountUserId?: string;
  adminUserId?: string;
  subjectType?: string;
  isAdmin?: boolean;
  platform?: string;
  locale?: string;
  appVersion?: string;
  notificationsEnabled?: boolean;
}): Promise<ApiResponse> {
  return (async () => {
    const authToken = getAuthToken();
    const withAuth = Boolean(authToken);
    const token = toString(payload?.token);
    const deviceId = toString(payload?.installId);
    const notificationsEnabled = payload?.notificationsEnabled !== false;

    // Build context for rich identity
    const accountUserId = toString(payload?.accountUserId) || undefined;
    const adminUserId = toString(payload?.adminUserId) || undefined;
    const subjectType = toString(payload?.subjectType) || undefined;
    const isAdmin = payload?.isAdmin !== undefined ? Boolean(payload.isAdmin) : undefined;

    const legacyPayload = {
      installId: deviceId || undefined,
      token: token || undefined,
      userId: toString(payload?.userId) || undefined,
      accountUserId,
      adminUserId,
      subjectType,
      isAdmin,
      platform: normalizePushPlatform(payload?.platform),
      locale: toString(payload?.locale) || undefined,
      appVersion: toString(payload?.appVersion) || undefined,
      notificationsEnabled: notificationsEnabled,
      supportChatOpen: Boolean((payload as any)?.supportChatOpen),
      supportChatSeenAt: toString((payload as any)?.supportChatSeenAt) || undefined,
    };

    if (!notificationsEnabled || !token) {
      if (!token && !deviceId) {
        return unsupportedNoop("Push device sync");
      }

      const unregisterResponse = await requestApi("/push-notifications/devices/unregister", {
        method: "POST",
        includeAuth: withAuth,
        body: {
          token: token || undefined,
          deviceId: deviceId || undefined,
        },
      });

      if (!unregisterResponse.success) {
        if (shouldFallbackToLegacyPushRoute(unregisterResponse)) {
          const legacyUnregister = await unregisterPushDeviceLegacy({
            installId: deviceId || "",
            token: token || undefined,
            userId: toString(payload?.userId) || undefined,
            platform: normalizePushPlatform(payload?.platform),
          });
          if (legacyUnregister.success) {
            return {
              success: true,
              data: {
                mode: "unregister",
                ...(legacyUnregister.data || {}),
              },
            };
          }
        }
        return unregisterResponse;
      }

      return {
        success: true,
        data: {
          mode: "unregister",
          ...(unregisterResponse.data || {}),
        },
      };
    }

    const registerResponse = await requestApi("/push-notifications/devices/register", {
      method: "POST",
      includeAuth: withAuth,
      body: {
        token,
        platform: normalizePushPlatform(payload?.platform),
        deviceId: deviceId || undefined,
        appVersion: toString(payload?.appVersion) || undefined,
        locale: toString(payload?.locale) || undefined,
        timezone: getCurrentTimezoneName() || undefined,
        userId: payload?.userId !== undefined ? String(payload.userId) : undefined,
        notificationsEnabled: notificationsEnabled,
        // Identity context
        accountUserId,
        adminUserId,
        subjectType,
        isAdmin,
        // snake_case forms
        account_user_id: accountUserId,
        admin_user_id: adminUserId,
        subject_type: subjectType,
        is_admin: isAdmin,
        user_id: payload?.userId !== undefined ? String(payload.userId) : undefined,
        // customFields for additional metadata
        customFields: {
          accountUserId,
          adminUserId,
          subjectType,
          isAdmin,
        },
      },
    });

    if (!registerResponse.success && shouldFallbackToLegacyPushRoute(registerResponse)) {
      const legacyRegister = await syncPushDeviceLegacy(legacyPayload);
      if (legacyRegister.success) {
        return legacyRegister;
      }
    }

    return registerResponse;
  })();
}

export function unregisterPushDevice(payload: {
  installId: string;
  token?: string;
  userId?: string;
  platform?: string;
}): Promise<ApiResponse> {
  return (async () => {
    const authToken = getAuthToken();
    const withAuth = Boolean(authToken);

    const response = await requestApi("/push-notifications/devices/unregister", {
      method: "POST",
      includeAuth: withAuth,
      body: {
        token: toString(payload?.token) || undefined,
        deviceId: toString(payload?.installId) || undefined,
        installId: toString(payload?.installId) || undefined,
      },
    });

    if (!response.success && shouldFallbackToLegacyPushRoute(response)) {
      const legacyResponse = await unregisterPushDeviceLegacy(payload);
      if (legacyResponse.success) {
        return legacyResponse;
      }
    }

    return response;
  })();
}

export function getPushNotificationSummary(adminPhone: string): Promise<ApiResponse> {
  return (async () => {
    const authToken = getAuthToken();
    if (!authToken) {
      return {
        success: false,
        error: "Push admin summary requires admin login.",
      };
    }

    const response = await requestApi("/admin/push-notifications", {
      query: {
        limit: 20,
        offset: 0,
      },
    });

    if (!response.success) {
      if (shouldFallbackToLegacyPushRoute(response)) {
        const legacyResponse = await requestApi("/api/esim-app/push/admin/summary", {
          query: { adminPhone },
          baseCandidates: getApiOriginCandidates(),
        });
        if (legacyResponse.success) {
          return legacyResponse;
        }
      }
      return response;
    }

    const raw = unwrapApiData(response) || response;
    const notifications = Array.isArray(raw?.notifications) ? raw.notifications : [];
    const latest = notifications[0] || null;

    const latestDeliveryCount = Math.max(
      0,
      toNumber(latest?.successCount, 0) + toNumber(latest?.failureCount, 0),
    );

    const providerConfigured = !notifications.some((entry: any) =>
      String(entry?.errorMessage || "").toLowerCase().includes("not configured"),
    );

    return {
      success: true,
      data: {
        providerConfigured,
        totalDevices: latestDeliveryCount,
        enabledDevices: latestDeliveryCount,
        authenticatedDevices: latestDeliveryCount,
        loyaltyDevices: 0,
        activeEsimDevices: 0,
        iosDevices: 0,
        androidDevices: 0,
        lastCampaign: latest
          ? {
              title: toString(latest?.title),
              createdAt: toString(latest?.createdAt || latest?.sentAt),
            }
          : null,
      },
    };
  })();
}

export function getPushNotificationDiagnostics(adminPhone: string): Promise<ApiResponse> {
  return (async () => {
    const authToken = getAuthToken();
    if (!authToken) {
      return {
        success: false,
        error: "Push admin diagnostics requires admin login.",
      };
    }

    const response = await requestApi("/admin/push-notifications/diagnostics");
    if (response.success) {
      return response;
    }

    if (shouldFallbackToLegacyPushRoute(response)) {
      const legacySummary = await requestApi("/api/esim-app/push/admin/summary", {
        query: { adminPhone },
        baseCandidates: getApiOriginCandidates(),
      });
      if (legacySummary.success) {
        const raw = unwrapApiData(legacySummary) || legacySummary;
        return {
          success: true,
          data: {
            activePushDevices: toNumber(raw?.enabledDevices ?? raw?.activePushDevices ?? 0, 0),
          },
        } as ApiResponse;
      }
    }

    return response;
  })();
}

export function sendPushNotification(payload: {
  adminPhone: string;
  title: string;
  body: string;
  route?: string;
  audience?: string;
  kind?: string;
  userIds?: string[];
  tokens?: string[];
}): Promise<ApiResponse> {
  return (async () => {
    const authToken = getAuthToken();
    const title = toString(payload?.title);
    const body = toString(payload?.body);
    const requestedAudience = parsePushAudience(payload?.audience);
    const kind = normalizePushKind(payload?.kind);
    const routeOrUrl = toString(payload?.route);

    if (!title || !body) {
      return {
        success: false,
        error: "Push title and body are required.",
      };
    }

    const inAppRoute = routeOrUrl.startsWith("/") ? routeOrUrl : "";
    const externalUrl = /^https:\/\//i.test(routeOrUrl) ? routeOrUrl : "";
    const targetUserIds = Array.isArray(payload?.userIds)
      ? payload.userIds.map((id) => toString(id)).filter(Boolean)
      : [];
    const directTokens = Array.isArray(payload?.tokens)
      ? payload.tokens.map((token) => toString(token)).filter(Boolean)
      : [];
    const hasSpecificUsers = targetUserIds.length > 0;
    // Backend merges `audience` with `userIds`; for specific-user sends we must omit audience
    // to avoid accidental broadcast to the full audience.
    const effectiveAudience = hasSpecificUsers ? "" : (requestedAudience || "all");
    const shouldBroadcastAll = !hasSpecificUsers && effectiveAudience === "all";
    const legacyPayload = {
      adminPhone: toString(payload?.adminPhone),
      title,
      body,
      route: inAppRoute || "",
      externalUrl: externalUrl || "",
      audience: effectiveAudience,
      kind,
      includeUserIds: targetUserIds,
    };

    if (!authToken) {
      return {
        success: false,
        error: "Push admin send requires admin login.",
      };
    }

    const requestBody = hasSpecificUsers
      ? {
          title,
          body,
          userIds: targetUserIds,
          user_ids: targetUserIds,
          includeUserIds: targetUserIds,
          audience: null,
          sendToAllActive: false,
          send_to_all_active: false,
          tokens: [],
          route: inAppRoute || undefined,
          externalUrl: externalUrl || undefined,
          data: {
            kind,
            audience: effectiveAudience,
            route: inAppRoute || undefined,
            path: inAppRoute || undefined,
            externalUrl: externalUrl || undefined,
          },
        }
      : {
          title,
          body,
          audience: effectiveAudience,
          sendToAllActive: shouldBroadcastAll,
          send_to_all_active: shouldBroadcastAll,
          channelId: kind,
          channel_id: kind,
          userIds: [],
          user_ids: [],
          includeUserIds: [],
          tokens: directTokens,
          route: inAppRoute || undefined,
          externalUrl: externalUrl || undefined,
          data: {
            kind,
            audience: effectiveAudience,
            route: inAppRoute || undefined,
            path: inAppRoute || undefined,
            externalUrl: externalUrl || undefined,
          },
        };

    const response = await requestApi("/admin/push-notifications/send", {
      method: "POST",
      body: requestBody,
    });

    try {
      console.info("[push-admin-send] request", {
        mode: hasSpecificUsers ? "users" : "audience",
        audience: effectiveAudience || null,
        userIdsCount: targetUserIds.length,
        sendToAllActive: shouldBroadcastAll,
        tokensCount: directTokens.length,
      });
      console.info("[push-admin-send] response", { success: response.success, error: response.error || null });
    } catch {
      // No-op logging guard.
    }

    if (!response.success) {
      if (hasSpecificUsers) {
        // Never fallback for specific-user sends; a legacy route may broaden recipient scope.
        return response;
      }
      if (shouldFallbackToLegacyPushRoute(response)) {
        const legacyResponse = await requestApi("/api/esim-app/push/admin/send", {
          method: "POST",
          body: legacyPayload,
          baseCandidates: getApiOriginCandidates(),
        });
        try {
          console.info("[push-admin-send] legacy-response", {
            success: legacyResponse.success,
            error: legacyResponse.error || null,
          });
        } catch {
          // No-op logging guard.
        }
        if (legacyResponse.success) {
          return legacyResponse;
        }
      }
      return response;
    }

    const raw = unwrapApiData(response) || response;
    const delivery = raw?.delivery || {};
    const invalidTokenCount =
      toNumber(delivery?.invalidTokenCount, NaN) ||
      (Array.isArray(delivery?.invalidTokens) ? delivery.invalidTokens.length : 0) ||
      (Array.isArray(raw?.invalidTokens) ? raw.invalidTokens.length : 0);

    const normalizedDelivery = {
      ...(delivery && typeof delivery === "object" ? delivery : {}),
      requestedTokens: toNumber(delivery?.requestedTokens, 0),
      successCount: toNumber(delivery?.successCount, 0),
      failureCount: toNumber(delivery?.failureCount, 0),
      invalidTokenCount: Number.isFinite(Number(invalidTokenCount)) ? Number(invalidTokenCount) : 0,
    };

    try {
      const isDevMode = Boolean((import.meta as any)?.env?.DEV);
      const debug = raw?.debug ?? raw?.data?.debug ?? null;
      if (isDevMode && debug) {
        const pick = {
          payloadAudience: (debug as any)?.payload?.audience ?? (debug as any)?.payloadAudience ?? null,
          payloadSendToAllActive:
            (debug as any)?.payload?.send_to_all_active ??
            (debug as any)?.payload?.sendToAllActive ??
            (debug as any)?.payloadSendToAllActive ??
            null,
          payloadUserIds:
            Array.isArray((debug as any)?.payload?.user_ids)
              ? (debug as any).payload.user_ids.length
              : Array.isArray((debug as any)?.payload?.userIds)
              ? (debug as any).payload.userIds.length
              : Array.isArray((debug as any)?.payloadUserIds)
              ? (debug as any).payloadUserIds.length
              : 0,
          recipientScope: (debug as any)?.recipient_scope ?? (debug as any)?.recipientScope ?? null,
          requestedUserIdsCount:
            (debug as any)?.requested_user_ids_count ?? (debug as any)?.requestedUserIdsCount ?? null,
          audienceUserIdsCount:
            (debug as any)?.audience_user_ids_count ?? (debug as any)?.audienceUserIdsCount ?? null,
          storeTokensCount: (debug as any)?.store_tokens_count ?? (debug as any)?.storeTokensCount ?? null,
          dedupedTokensCount:
            (debug as any)?.deduped_tokens_count ?? (debug as any)?.dedupedTokensCount ?? null,
          matchedUserIdsCount: Array.isArray((debug as any)?.matched_user_ids)
            ? (debug as any).matched_user_ids.length
            : Array.isArray((debug as any)?.matchedUserIds)
            ? (debug as any).matchedUserIds.length
            : 0,
        };
        console.info("[push-admin-send] debug", pick);
      }
    } catch {
      // No-op logging guard.
    }

    return {
      success: true,
      data: {
        ...raw,
        delivery: normalizedDelivery,
        requestedTokens: normalizedDelivery.requestedTokens,
        successCount: normalizedDelivery.successCount,
        failureCount: normalizedDelivery.failureCount,
        invalidTokenCount: normalizedDelivery.invalidTokenCount,
      },
    };
  })();
}

export function sendAppUpdatePushNotification(payload: {
  title: string;
  body: string;
  appStoreUrl: string;
  playStoreUrl: string;
  audience?: string;
  dryRun?: boolean;
}): Promise<ApiResponse> {
  return (async () => {
    const authToken = getAuthToken();
    if (!authToken) {
      return {
        success: false,
        error: "Push admin send requires admin login.",
      };
    }

    const title = toString(payload?.title);
    const body = toString(payload?.body);
    const appStoreUrl = toString(payload?.appStoreUrl);
    const playStoreUrl = toString(payload?.playStoreUrl);
    const audience = normalizePushAudience(payload?.audience);
    const dryRun = Boolean(payload?.dryRun);

    if (!title || !body || !appStoreUrl || !playStoreUrl) {
      return {
        success: false,
        error: "Title, body, App Store URL, and Play Store URL are required.",
      };
    }

    // First try standard push/send with app_update parameters for better delivery
    const primaryResponse = await requestApi("/admin/push-notifications/send", {
      method: "POST",
      body: {
        title,
        body,
        audience,
        dryRun,
        kind: "app_update",
        type: "app_update",
        notificationType: "app_update",
        // Extended URLs for native compatibility
        appStoreUrl,
        playStoreUrl,
        iosExternalUrl: appStoreUrl,
        androidExternalUrl: playStoreUrl,
        iosUrl: appStoreUrl,
        androidUrl: playStoreUrl,
        data: {
          kind: "app_update",
          appStoreUrl,
          playStoreUrl,
          iosExternalUrl: appStoreUrl,
          androidExternalUrl: playStoreUrl,
          iosUrl: appStoreUrl,
          androidUrl: playStoreUrl,
        },
      },
    });

    if (primaryResponse.success) {
      return primaryResponse;
    }

    // Fallback to legacy app-update specifically if primary send fails
    const response = await requestApi("/admin/push-notifications/send-app-update", {
      method: "POST",
      body: {
        title,
        body,
        appStoreUrl,
        playStoreUrl,
        audience,
        dryRun,
      },
    });

    if (!response.success) {
      return response;
    }

    const raw = unwrapApiData(response) || response;
    const delivery = raw?.delivery || {};

    return {
      success: true,
      data: {
        ...raw,
        requestedTokens: toNumber(delivery?.requestedTokens ?? raw?.requestedTokens, 0),
        successCount: toNumber(delivery?.successCount ?? raw?.successCount, 0),
        failureCount: toNumber(delivery?.failureCount ?? raw?.failureCount, 0),
      },
    };
  })();
}

export function getMyEsims(userId?: string): Promise<ApiResponse> {
  return (async () => {
    const sleep = (ms: number) => new Promise<void>((resolve) => {
      setTimeout(resolve, Math.max(0, Math.floor(ms)));
    });

    const fetchProfiles = async (bustCache = false) =>
      requestApi("/esim-access/profiles/my", {
        includeAuth: true,
        query: {
          limit: 100,
          offset: 0,
          userId: userId || undefined,
          ...(bustCache ? { ts: Date.now() } : {}),
        },
      });

    const profilesResponse = await fetchProfiles(true);

    if (!profilesResponse.success) {
      return profilesResponse;
    }

    const data = unwrapApiData(profilesResponse) || profilesResponse;
    const initialRows = Array.isArray(data?.profiles)
      ? data.profiles
      : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
      ? data
      : [];
    let filtered = filterProfilesByUser(initialRows, userId);

    if (filtered.length === 0) {
      for (const delayMs of [350, 1000]) {
        await sleep(delayMs);
        const retryResponse = await fetchProfiles(true);
        if (!retryResponse.success) {
          continue;
        }
        const retryData = unwrapApiData(retryResponse) || retryResponse;
        const retryRows = Array.isArray(retryData?.profiles)
          ? retryData.profiles
          : Array.isArray(retryData?.rows)
          ? retryData.rows
          : Array.isArray(retryData?.items)
          ? retryData.items
          : Array.isArray(retryData)
          ? retryData
          : [];
        filtered = filterProfilesByUser(retryRows, userId);
        if (filtered.length > 0) {
          break;
        }
      }
    }

    const mapped = filtered.map((row: any) => {
      const rowRecord = toObjectRecord(row);
      const customFields = mergeProfileCustomFields(rowRecord);
      const checkoutSnapshot = extractCheckoutSnapshot(rowRecord, customFields);
      const snapshotCountry = toObjectRecord(checkoutSnapshot?.country);
      const snapshotPlan = toObjectRecord(checkoutSnapshot?.plan);
      const snapshotCountryCode = toUpper(
        snapshotCountry?.code ||
          snapshotCountry?.iso ||
          checkoutSnapshot?.countryCode ||
          checkoutSnapshot?.country_code,
      );
      const snapshotCountryName = toString(
        snapshotCountry?.name ||
          checkoutSnapshot?.countryName ||
          checkoutSnapshot?.country_name ||
          checkoutSnapshot?.country,
      );
      const snapshotPlanName = toString(
        snapshotPlan?.name ||
          checkoutSnapshot?.planName ||
          checkoutSnapshot?.packageName ||
          checkoutSnapshot?.name,
      );
      const usage = extractCanonicalUsageMb(row);
      const totalGb = usage.totalMb / 1024;
      const usedGb = usage.usedMb / 1024;
      const remainingGb = usage.remainingMb / 1024;
      const validityDays = computeValidityDays(row);
      const computedDaysLeft = computeDaysLeft(row, validityDays);
      const hasDaysLeft = Number.isFinite(computedDaysLeft) && computedDaysLeft >= 0;
      const daysLeft = hasDaysLeft ? Math.max(0, Math.floor(computedDaysLeft)) : 0;
      const countryCode = String(
        snapshotCountryCode ||
          customFields?.countryCode ||
          customFields?.country_code ||
          row?.country_code ||
          row?.countryCode ||
          "",
      )
        .trim()
        .toUpperCase();
      const countryName = String(
        snapshotCountryName ||
          customFields?.countryName ||
          customFields?.country_name ||
          customFields?.country ||
          row?.country_name ||
          row?.countryName ||
          countryCode ||
          "Unknown",
      ).trim();
      const planName = String(
        customFields?.packageName ||
          customFields?.package_name ||
          snapshotPlanName ||
          row?.country_name ||
          row?.countryName ||
          "Travel Plan",
      ).trim();
      return {
        id: String(row?.id || row?.iccid || row?.esim_tran_no || ""),
        userId: String(row?.user_id || row?.userId || ""),
        name: planName,
        country: countryName,
        flag: countryFlag(countryCode),
        status: mapProfileStatus(row),
        dataUsed: usedGb,
        dataTotal: totalGb,
        dataRemaining: remainingGb,
        dataUsedMb: usage.usedMb,
        dataTotalMb: usage.totalMb,
        dataRemainingMb: usage.remainingMb,
        usageUnit: usage.usageUnit,
        packageDataMb: usage.totalMb,
        daysLeft,
        hasDaysLeft,
        validityDays,
        installed: Boolean(row?.installed || row?.installed_at || row?.installedAt),
        installedAt: row?.installed_at || row?.installedAt || "",
        activatedDate: row?.activated_at || row?.activatedAt || "",
        activatedAt: row?.activated_at || row?.activatedAt || "",
        expiresAt: row?.expires_at || row?.expiresAt || "",
        activationCode:
          row?.activation_code ||
          row?.activationCode ||
          customFields?.activationCode ||
          customFields?.activation_code ||
          "",
        installUrl:
          row?.install_url ||
          row?.installUrl ||
          row?.qr_code_url ||
          row?.qrCodeUrl ||
          customFields?.installUrl ||
          customFields?.install_url ||
          customFields?.qrCodeUrl ||
          customFields?.qr_code_url ||
          "",
        iccid: row?.iccid || "",
        esimTranNo: row?.esim_tran_no || row?.esimTranNo || "",
        orderReference:
          row?.provider_order_no ||
          customFields?.providerOrderNo ||
          customFields?.provider_order_no ||
          customFields?.orderReference ||
          customFields?.order_reference ||
          customFields?.orderNumber ||
          customFields?.order_number ||
          row?.esim_tran_no ||
          "",
        customFields,
        purchaseSnapshot: {
          ...checkoutSnapshot,
          name: snapshotPlanName || planName,
          country: snapshotCountryName || countryName,
          countryCode: snapshotCountryCode || countryCode,
        },
        raw: row,
      };
    });
    return { success: true, data: mapped } as ApiResponse;
  })();
}

export function activateEsim(esimId: string, payload: { userId?: string; iccid?: string; esimTranNo?: string }): Promise<ApiResponse> {
  void esimId;
  return (async () => {
    const iccid = String(payload?.iccid || "").trim();
    const esimTranNo = String(payload?.esimTranNo || "").trim();
    if (!iccid && !esimTranNo) {
      return { success: false, error: "ICCID or eSIM transaction number is required to activate this eSIM." };
    }

    const installBody: AnyRecord = {
      ...(iccid ? { iccid } : {}),
      ...(esimTranNo ? { esimTranNo } : {}),
    };
    if (payload?.userId) {
      installBody.userId = String(payload.userId);
    }

    const installResult = await requestApi("/esim-access/profiles/install/my", {
      method: "POST",
      body: installBody,
      includeAuth: true,
    });
    const installError = String(installResult.error || "").toLowerCase();
    const installIsNonFatal =
      installError.includes("already installed") ||
      installError.includes("already active") ||
      installError.includes("already activated");
    if (!installResult.success && !installIsNonFatal) {
      return installResult;
    }

    const activateBody: AnyRecord = {
      iccid,
    };
    if (payload?.userId) {
      activateBody.userId = String(payload.userId);
    }

    const activateResult = await requestApi("/esim-access/profiles/activate/my", {
      method: "POST",
      body: activateBody,
      includeAuth: true,
    });
    const activateError = String(activateResult.error || "").toLowerCase();
    const activateIsNonFatal =
      activateError.includes("already active") ||
      activateError.includes("already activated");
    if (!activateResult.success && !activateIsNonFatal) {
      return activateResult;
    }

    if (activateResult.success) {
      return activateResult;
    }
    return installResult.success ? installResult : { success: true, data: { iccid, status: "active" } };
  })();
}

export function topupEsim(
  esimId: string,
  payload: {
    userId?: string;
    planId?: string;
    packageCode?: string;
    transactionId?: string;
    esimTranNo?: string;
    iccid?: string;
  },
): Promise<ApiResponse> {
  return (async () => {
    const packageCode = String(payload?.packageCode || payload?.planId || "").trim();
    const transactionId = String(payload?.transactionId || esimId || "").trim();
    const esimTranNo = String(payload?.esimTranNo || "").trim();
    const iccid = String(payload?.iccid || "").trim();

    if (!packageCode) {
      return { success: false, error: "Top-up package code is required." };
    }

    if (!transactionId) {
      return { success: false, error: "Top-up transactionId is required." };
    }

    const context = {
      actorPhone: getUserPhone() || null,
      platformCode: "tulip_mobile_app",
      platformName: "Tulip Mobile App",
      note: "Top-up requested from mobile app",
    };

    return requestApi("/esim-access/topup/managed", {
      method: "POST",
      body: {
        providerRequest: {
          packageCode,
          transactionId,
          esimTranNo: esimTranNo || undefined,
          iccid: iccid || undefined,
        },
        platformCode: context.platformCode,
        platformName: context.platformName,
        actorPhone: context.actorPhone || undefined,
        syncAfterTopup: true,
        userId: payload?.userId || undefined,
      },
      includeAuth: false,
    });
  })();
}

export function purchaseComplete(payload: AnyRecord): Promise<ApiResponse> {
  return (async () => {
    const packageCode = toString(payload?.planId || payload?.bundleName || payload?.packageCode);
    if (!packageCode) {
      return { success: false, error: "Missing plan package code." };
    }

    const transactionId = toString(payload?.transactionId);
    if (!transactionId) {
      return { success: false, error: "Missing transaction id." };
    }

    const meResponse = await requestApi("/auth/me");
    if (!meResponse.success) {
      return {
        success: false,
        error: meResponse.error || "Unable to read current user session.",
      };
    }

    const me = unwrapApiData(meResponse) || {};
    const accountStatus = resolveAccountStatus(me);
    if (isSoftDeletedStatus(accountStatus)) {
      return { success: false, error: "Account is deleted and cannot place orders." };
    }
    const userPhone = toString(me?.phone || getUserPhone());
    if (!userPhone) {
      return { success: false, error: "Missing user phone for managed booking." };
    }

    const userName = toString(me?.name || getUserName() || "User");
    const paymentMethod = toString(payload?.paymentMethod || "unknown").toLowerCase();
    const amountIqd = Math.max(0, Math.round(toNumber(payload?.amountIqd ?? payload?.amount ?? payload?.salePriceMinor, 0)));
    const countryCode = toUpper(payload?.country?.code || payload?.countryCode);
    const countryName = toString(payload?.country?.name || payload?.countryName);
    const packageSlug = toString(payload?.plan?.slug || payload?.packageSlug);
    const packageName = toString(payload?.plan?.name || payload?.packageName || payload?.country?.name || "eSIM Package");
    const customFields = payload?.customFields && typeof payload.customFields === "object" ? payload.customFields : {};

    const managedPayload: AnyRecord = {
      providerRequest: {
        transactionId,
        packageInfoList: [
          {
            packageCode,
            count: 1,
          },
        ],
      },
      user: {
        phone: userPhone,
        name: userName,
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
        ...customFields,
        paymentMethod,
        paymentStatus: toString(payload?.paymentStatus || "completed"),
        autoTopUp: Boolean(payload?.autoTopUp),
        checkoutSnapshot: payload?.plan && payload?.country
          ? {
              plan: payload.plan,
              country: payload.country,
            }
          : undefined,
      },
    };

    const orderResponse = await requestApi("/esim-access/orders/managed", {
      method: "POST",
      body: managedPayload,
      includeAuth: true,
    });

    if (!orderResponse.success) {
      return orderResponse;
    }

    const orderData = unwrapApiData(orderResponse) || orderResponse.data || {};
    const providerOrderNo = toString(orderData?.database?.providerOrderNo || orderData?.provider?.obj?.orderNo);

    let syncResult: ApiResponse | null = null;
    if (providerOrderNo) {
      syncResult = await requestApi("/esim-access/profiles/sync", {
        method: "POST",
        body: {
          providerRequest: {
            orderNo: providerOrderNo,
          },
          platformCode: "tulip_mobile_app",
          platformName: "Tulip Mobile App",
          actorPhone: userPhone,
        },
        includeAuth: true,
      });
    }

    return {
      success: true,
      data: {
        order: orderData,
        sync: syncResult?.success ? (unwrapApiData(syncResult) || syncResult.data || null) : null,
      },
    } as ApiResponse;
  })();
}

export function purchaseLoyalty(payload: AnyRecord): Promise<ApiResponse> {
  return (async () => {
    const loyaltyStatus = await getLoyaltyStatus(String(payload?.userId || "").trim() || undefined);
    if (!loyaltyStatus.success) {
      return loyaltyStatus;
    }

    if (!Boolean(loyaltyStatus.data?.hasAccess)) {
      return {
        success: false,
        error: "Loyalty is not enabled for this account.",
      };
    }

    return purchaseComplete({
      ...payload,
      paymentMethod: "loyalty",
      paymentStatus: "approved",
    });
  })();
}

export async function createFibPayment(payload: {
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
      // FIB endpoints are user-scoped and require bearer authentication on backend.
      includeAuth: true,
    });

    if (response.success) {
      return response;
    }

    const errorText = toString(response.error || "");
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

  if (!isBackendCapabilityEnabled("fibPayments")) {
    return unsupported("FIB payment");
  }

  return { success: false, error: lastError || "Unable to create FIB payment." };
}
