import * as client from "./esim-app-client";
import { resolveCountryName } from "./country-names";
import { getCachedResource, invalidateCachedResource } from "./query-cache";
import {
  clearAuthSession,
  getAuthToken,
  getUserEmail,
  getUserName,
  isAuthenticated as hasStoredSession,
  getUserId as getStoredUserId,
  setAuthSession,
} from "./session";
import { isNativePushEnabled } from "./config";
import type { ApiResponse, AnyRecord } from "./types";
import { getCheckoutReturnUrl } from "../utils/native-payment";

const ROOT_ADMIN_PHONE = "+9647507343635";
const HOME_POPULAR_CONTENT_CACHE_KEY = "home.popular.content.v1";
const HOME_POPULAR_CODES_CACHE_KEY = "home.popular.codes.v1";
const POPULAR_DESTINATIONS_CACHE_KEY = "catalog.popular-destinations";
const ALL_DESTINATIONS_CACHE_KEY = "catalog.all-destinations";
const CURRENCY_SETTINGS_CACHE_KEY = "settings.currency";
const WHITELIST_SETTINGS_CACHE_KEY = "settings.whitelist";
const SUPER_ADMINS_CACHE_KEY = "admin.super-admins";
const PENDING_ORDER_STORAGE_KEY = "pendingOrderData";
const MY_ESIMS_SHADOW_ROWS_KEY_PREFIX = "esim.myEsims.shadowRows.v1.";
const MY_ESIMS_SHADOW_TTL_MS = 10 * 24 * 60 * 60 * 1000;
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const SETTINGS_CACHE_TTL_MS = 60 * 1000;

function toNumber(value: any, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: any, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: any, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value !== 0 : fallback;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["true", "1", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off", "disabled", "null", "none"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function flagFromIso(code: string): string {
  const iso = String(code || "").trim().toUpperCase();
  if (iso.length !== 2) {
    return "🌍";
  }
  return String.fromCodePoint(127397 + iso.charCodeAt(0), 127397 + iso.charCodeAt(1));
}

function normalizeDestination(item: any, index: number): AnyRecord {
  const code = String(item?.code || item?.iso || item?.country_code || "").trim().toUpperCase();
  const name = String(item?.name || item?.country_name || code || "Unknown").trim();
  const priceFrom = toNumber(item?.priceFrom ?? item?.price_from ?? item?.min_price ?? 0, 0);
  const id = item?.id ?? code ?? index + 1;
  const flag = String(item?.flag || item?.emoji || flagFromIso(code) || "🌍");
  const plansCount = toInt(item?.plansCount ?? item?.plans ?? 0, 0);
  const type = String(item?.type || (code.length === 2 ? "country" : "regional")).toLowerCase();

  return {
    id,
    name,
    flag,
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
    const code = item.trim().toUpperCase();
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
  const code = String(normalized.code || normalized.iso || "").trim().toUpperCase();
  const name = String(normalized.name || "").trim();

  return {
    ...normalized,
    code,
    iso: code,
    name: name || resolveCountryName(code) || code || "Unknown",
    flag: String(normalized.flag || flagFromIso(code) || "🌍"),
  };
}

function normalizePlan(item: any, index: number): AnyRecord {
  const id = item?.id ?? item?.bundleName ?? item?.bundle_name ?? `plan-${index + 1}`;
  const data = toNumber(item?.data ?? item?.dataGB ?? item?.data_gb ?? 0, 0);
  const validity = toInt(item?.validity ?? item?.durationDays ?? item?.duration_days ?? 0, 0);
  const price = toNumber(item?.price ?? 0, 0);
  const unlimited =
    typeof item?.unlimited === "boolean"
      ? item.unlimited
      : typeof item?.unlimited === "string"
      ? ["1", "true", "yes", "on", "enabled"].includes(item.unlimited.trim().toLowerCase())
      : false;
  const allowanceMode = String(item?.allowanceMode ?? item?.allowance_mode ?? "").trim();

  return {
    ...item,
    id,
    data,
    dataGB: data,
    validity,
    price,
    unlimited,
    allowanceMode,
    allowance_mode: allowanceMode,
    coverageCountries: item?.coverageCountries || item?.coverage_countries || [],
  };
}

function extractApiData<T = any>(response: ApiResponse<T>): T | undefined {
  return response?.data as T;
}

function resolveAuthToken(data: any): string {
  return String(
    data?.token ||
      data?.accessToken ||
      data?.access_token ||
      "",
  ).trim();
}

function normalizeStrictSubjectType(raw: unknown): "user" | "admin" | "" {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "user" || value === "admin") {
    return value;
  }
  return "";
}

function parseAuthBoolean(raw: unknown): boolean | undefined {
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

interface AuthIdentity {
  token: string;
  id: string;
  phone: string;
  name: string;
  email?: string;
  subjectType: "user" | "admin";
  isAdmin: boolean;
  adminUserId?: string;
  accountUserId?: string;
}

function normalizeAuthIdentity(
  data: any,
  options: {
    requireToken: boolean;
    source: string;
    fallbackPhone?: string;
    fallbackName?: string;
  },
): { identity?: AuthIdentity; error?: string } {
  const token = resolveAuthToken(data);
  if (options.requireToken && !token) {
    return {
      error: `${options.source} did not return accessToken.`,
    };
  }

  const subjectType = normalizeStrictSubjectType(data?.subjectType ?? data?.subject_type);
  const isAdminValue = parseAuthBoolean(data?.isAdmin ?? data?.is_admin);
  const resolvedSubjectType =
    subjectType === "admin" || isAdminValue === true
      ? "admin"
      : subjectType === "user" || isAdminValue === false
      ? "user"
      : "";
  if (!resolvedSubjectType) {
    return {
      error:
        `${options.source} did not include role metadata. Expected subjectType and/or isAdmin.`,
    };
  }

  const id = String(data?.id || data?.userId || data?.user_id || data?.adminUserId || data?.admin_user_id || "").trim();
  if (!id) {
    return {
      error: `${options.source} did not include id.`,
    };
  }

  const phone = String(data?.phone || options.fallbackPhone || "").trim();
  const name = String(data?.name || options.fallbackName || phone || "").trim();
  const email = String(data?.email || "").trim();
  const adminUserId = String(data?.adminUserId || data?.admin_user_id || "").trim();
  const accountUserId = String(data?.userId || data?.user_id || "").trim();

  return {
    identity: {
      token,
      id,
      phone,
      name,
      email: email || undefined,
      subjectType: resolvedSubjectType,
      isAdmin: resolvedSubjectType === "admin",
      adminUserId: adminUserId || undefined,
      accountUserId: accountUserId || undefined,
    },
  };
}

function persistAuthIdentity(identity: AuthIdentity): void {
  setAuthSession({
    token: identity.token,
    userId: identity.id,
    id: identity.id,
    adminUserId: identity.adminUserId,
    accountUserId: identity.accountUserId,
    phone: identity.phone,
    name: identity.name,
    email: identity.email,
    isAdmin: identity.isAdmin,
    subjectType: identity.subjectType,
  });
}

function hasRoleMismatch(left: AuthIdentity, right: AuthIdentity): boolean {
  return (
    left.id !== right.id ||
    left.subjectType !== right.subjectType ||
    left.isAdmin !== right.isAdmin ||
    String(left.adminUserId || "") !== String(right.adminUserId || "") ||
    String(left.accountUserId || "") !== String(right.accountUserId || "")
  );
}

function isMissingFieldValidationError(error: unknown): boolean {
  const message = String(error || "").trim().toLowerCase();
  return message.includes("field required");
}

function getAdminPhone(): string {
  const override = String(localStorage.getItem("esimAdminPhone") || "").trim();
  if (override) {
    return override;
  }
  return ROOT_ADMIN_PHONE;
}

function getAccountDeletionPageUrl(): string {
  const fromStorage = String(localStorage.getItem("esimAccountDeletionUrl") || "").trim();
  if (fromStorage) {
    return fromStorage;
  }

  const env = (import.meta as any)?.env || {};
  return String(env.VITE_ACCOUNT_DELETION_URL || "").trim();
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

function getMyEsimsShadowKey(): string {
  const userId = String(getStoredUserId() || "").trim();
  return userId ? `${MY_ESIMS_SHADOW_ROWS_KEY_PREFIX}${userId}` : "";
}

function readMyEsimsShadowRows(): AnyRecord[] {
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

function writeMyEsimsShadowRows(rows: AnyRecord[]): void {
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

function toTrimmedUpper(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function toTrimmed(value: unknown): string {
  return String(value || "").trim();
}

function getShadowIdentityKey(row: AnyRecord): string {
  return (
    toTrimmed(row?.provider_order_no || row?.providerOrderNo) ||
    toTrimmed(row?.esim_tran_no || row?.esimTranNo) ||
    toTrimmed(row?.iccid) ||
    toTrimmed(row?.transactionId) ||
    toTrimmed(row?.id)
  );
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
  const userId = String(getStoredUserId() || "").trim();
  if (!userId || !purchaseResult || typeof purchaseResult !== "object") {
    return;
  }

  const payload = purchaseResult as AnyRecord;
  const esimList = extractEsimListFromPurchasePayload(payload);
  const orderNoFallback = toTrimmed(
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

  const now = Date.now();
  const fromEsimList = esimList
    .map((entry: AnyRecord, index) => {
      const packageRow = Array.isArray(entry?.packageList) && entry.packageList.length > 0 ? entry.packageList[0] : {};
      const countryCode = toTrimmedUpper(packageRow?.locationCode || checkoutContext?.country?.code);
      const countryName = toTrimmed(
        checkoutContext?.country?.name ||
          resolveCountryName(countryCode) ||
          countryCode ||
          "Unknown",
      );
      const totalDataMb = Math.max(0, Math.round(toNumber(entry?.totalVolume, 0) / (1024 * 1024)));
      const packageName = toTrimmed(packageRow?.packageName || countryName || "Travel Plan");
      const providerOrderNo = toTrimmed(entry?.orderNo || orderNoFallback);
      const esimTranNo = toTrimmed(entry?.esimTranNo);
      const iccid = toTrimmed(entry?.iccid);
      const activationCode = toTrimmed(entry?.ac);
      const installUrl = toTrimmed(entry?.shortUrl || entry?.qrCodeUrl);
      const shadowId = toTrimmed(`shadow-${providerOrderNo || esimTranNo || iccid || now}-${index + 1}`);

      return {
        id: shadowId,
        user_id: userId,
        userId,
        iccid,
        country_code: countryCode,
        countryCode,
        country_name: countryName,
        countryName: countryName,
        status: "inactive",
        installed: false,
        installed_at: "",
        installedAt: "",
        activated_at: "",
        activatedAt: "",
        expires_at: toTrimmed(entry?.expiredTime || ""),
        expiresAt: toTrimmed(entry?.expiredTime || ""),
        totalDataMb,
        packageDataMb: totalDataMb,
        usedDataMb: 0,
        remainingDataMb: totalDataMb,
        usageUnit: "MB",
        activation_code: activationCode,
        activationCode,
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
            ? {
                country: checkoutContext.country,
                plan: checkoutContext.plan,
              }
            : undefined,
          shadowStatus: toTrimmed(entry?.esimStatus || entry?.smdpStatus || "GOT_RESOURCE"),
        },
        __shadowCreatedAt: now,
      } as AnyRecord;
    })
    .filter((row) => Boolean(getShadowIdentityKey(row)));

  const fallbackRows: AnyRecord[] = [];
  if (fromEsimList.length === 0 && orderNoFallback) {
    const countryCode = toTrimmedUpper(checkoutContext?.country?.code);
    const countryName = toTrimmed(
      checkoutContext?.country?.name ||
        resolveCountryName(countryCode) ||
        countryCode ||
        "Unknown",
    );
    const planDataGb = Math.max(0, toNumber(checkoutContext?.plan?.data, 0));
    const fallbackDataMb = Math.max(0, Math.round(planDataGb * 1024));
    const packageName = toTrimmed(countryName || "Travel Plan");
    const shadowId = toTrimmed(`shadow-${orderNoFallback || now}-fallback`);
    fallbackRows.push({
      id: shadowId,
      user_id: userId,
      userId,
      iccid: "",
      country_code: countryCode,
      countryCode,
      country_name: countryName,
      countryName: countryName,
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
      usageUnit: "MB",
      activation_code: "",
      activationCode: "",
      install_url: "",
      installUrl: "",
      esim_tran_no: "",
      esimTranNo: "",
      provider_order_no: orderNoFallback,
      providerOrderNo: orderNoFallback,
      custom_fields: {
        usageUnit: "MB",
        packageDataMb: fallbackDataMb,
        packageName,
        countryCode,
        countryName,
        checkoutSnapshot: checkoutContext?.country && checkoutContext?.plan
          ? {
              country: checkoutContext.country,
              plan: checkoutContext.plan,
            }
          : undefined,
        shadowStatus: "BOOKED",
      },
      __shadowCreatedAt: now,
    } as AnyRecord);
  }

  const newRows = [...fromEsimList, ...fallbackRows].filter((row) => Boolean(getShadowIdentityKey(row)));
  if (newRows.length === 0) {
    return;
  }

  const existing = readMyEsimsShadowRows();
  const mergedByKey = new Map<string, AnyRecord>();

  [...existing, ...newRows].forEach((row) => {
    const key = getShadowIdentityKey(row);
    if (!key) {
      return;
    }
    mergedByKey.set(key, row);
  });

  writeMyEsimsShadowRows(Array.from(mergedByKey.values()));
}

function normalizePaymentPayload(raw: any): AnyRecord {
  const payload = raw && typeof raw === "object" && raw.data ? raw.data : raw;
  const links = payload?.links || {};

  const paymentLink =
    payload?.paymentLink ||
    payload?.payment_link ||
    payload?.paymentUrl ||
    payload?.payment_url ||
    payload?.personalAppLink ||
    links?.personal ||
    links?.business ||
    links?.corporate ||
    "";

  const qrCodeUrl = payload?.qrCodeUrl || payload?.qr_url || payload?.qrCode || payload?.qr || "";
  const paymentId = payload?.paymentId || payload?.payment_id || payload?.reference || payload?.readable_code || "";

  return {
    paymentLink,
    qrCodeUrl,
    paymentId,
    reference: payload?.reference || payload?.readable_code || paymentId,
    raw: payload,
  };
}

async function resolveCurrencySettingsForCheckout(): Promise<{ exchangeRate: string; markupPercent: string }> {
  const response = await getCurrencySettings();
  if (response.success && response.data) {
    return {
      exchangeRate: String(response.data.exchangeRate || "1320"),
      markupPercent: String(response.data.markupPercent || "0"),
    };
  }
  return { exchangeRate: "1320", markupPercent: "0" };
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
  const userId = getStoredUserId();

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
    },
  };
}

function createPurchaseTransactionId(prefix = "ORDER"): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function requireUserId(): ApiResponse<never> | null {
  const token = String(getAuthToken() || "").trim();
  if (!token) {
    return { success: false, error: "Session expired. Please login again.", statusCode: 401 };
  }

  const userId = getStoredUserId();
  if (userId) {
    return null;
  }
  return { success: false, error: "Session expired. Please login again.", statusCode: 401 };
}

export function clearAuth(): void {
  clearAuthSession();
}

export function isAuthenticated(): boolean {
  return hasStoredSession();
}

export async function signup(phone: string, name: string, _password?: string): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const requestedPassword = String(_password || "").trim();
  const response = await client.signup({
    phone,
    name,
    password: requestedPassword || undefined,
  });
  const data = extractApiData<any>(response);

  if (!response.success) {
    return {
      success: false,
      error: response.error || "Signup failed",
    };
  }

  let userId = String(data?.userId || data?.id || "").trim();
  const token = resolveAuthToken(data);

  // Some backends create the account first, then require login to issue token.
  if ((!userId || !token) && requestedPassword) {
    const loginResponse = await login(phone, requestedPassword);
    if (loginResponse.success && loginResponse.data) {
      return loginResponse;
    }
  }

  if (!userId) {
    return {
      success: false,
      error: "Signup succeeded but user id is missing in backend response.",
    };
  }

  if (!token) {
    return {
      success: false,
      error: "Signup completed but login token was not returned. Please log in.",
    };
  }

  let normalized = normalizeAuthIdentity(data, {
    requireToken: true,
    source: "Signup response",
    fallbackPhone: phone,
    fallbackName: name,
  });

  if (!normalized.identity) {
    const meResponse = await client.getAuthMeIdentity(token);
    if (meResponse.success && meResponse.data) {
      normalized = normalizeAuthIdentity(
        {
          ...(meResponse.data as AnyRecord),
          accessToken: token,
        },
        {
          requireToken: true,
          source: "Signup /auth/me response",
          fallbackPhone: phone,
          fallbackName: name,
        },
      );
    }
  }

  if (!normalized.identity) {
    return {
      success: false,
      error:
        normalized.error
        || "Signup succeeded but backend role metadata is missing. Please contact support.",
    };
  }

  const identity = normalized.identity;
  userId = identity.id;

  persistAuthIdentity(identity);

  if (isNativePushEnabled()) {
    void import("./push-notifications-service")
      .then((service) => service.syncPushUserContext())
      .catch((error) => {
        console.warn("Post-signup push sync skipped:", error);
      });
  }

  return {
    success: true,
    data: {
      userId,
      phone: identity.phone || String(phone || ""),
      name: identity.name || String(name || phone || ""),
    },
  };
}

export async function login(phone: string, password?: string): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const response = await client.login({ phone, password: password || "" });
  const data = extractApiData<any>(response);

  if (!response.success || !data?.userId) {
    return {
      success: false,
      error: response.error || "Login failed",
    };
  }

  const normalized = normalizeAuthIdentity(data, {
    requireToken: true,
    source: "Login response",
    fallbackPhone: phone,
  });
  if (!normalized.identity) {
    return {
      success: false,
      error: normalized.error || "Login response is missing required identity fields.",
    };
  }

  let identity = normalized.identity;
  persistAuthIdentity(identity);

  try {
    const meResponse = await client.getAuthMeIdentity(identity.token);
    if (meResponse.success && meResponse.data) {
      const reconciled = normalizeAuthIdentity(
        {
          ...(meResponse.data as AnyRecord),
          accessToken: identity.token,
        },
        {
          requireToken: true,
          source: "/auth/me response",
          fallbackPhone: identity.phone || phone,
          fallbackName: identity.name,
        },
      );

      if (reconciled.identity) {
        const nextIdentity: AuthIdentity = {
          ...identity,
          ...reconciled.identity,
          token: identity.token,
        };
        const roleChanged = hasRoleMismatch(identity, nextIdentity);
        const profileChanged = identity.phone !== nextIdentity.phone || identity.name !== nextIdentity.name;
        if (roleChanged || profileChanged) {
          persistAuthIdentity(nextIdentity);
        }
        identity = nextIdentity;
      }
    }
  } catch {
    // /auth/me reconcile is best-effort; keep login identity when unavailable.
  }

  if (isNativePushEnabled()) {
    void import("./push-notifications-service")
      .then((service) => service.syncPushUserContext())
      .catch((error) => {
        console.warn("Post-login push sync skipped:", error);
      });
  }

  return {
    success: true,
    data: {
      userId: identity.id,
      phone: identity.phone || String(phone || ""),
      name: identity.name || String(phone || ""),
    },
  };
}

export function getAccountDeletionUrl(): string {
  return getAccountDeletionPageUrl();
}

export async function deleteMyAccount(): Promise<ApiResponse<any>> {
  const userId = String(getStoredUserId() || "").trim();
  if (!userId) {
    return { success: false, error: "User is not authenticated" };
  }

  const selfDelete = await client.deleteCurrentUser({ userId });
  if (selfDelete.success && String(selfDelete.data?.status || "").trim().toLowerCase() === "deleted") {
    return selfDelete;
  }

  const deleteUrl = getAccountDeletionPageUrl();
  if (deleteUrl) {
    return {
      success: false,
      error: `${
        selfDelete.error || "Unable to delete account"
      }. Use the account deletion webpage.`,
      data: { deleteUrl },
    };
  }

  return {
    success: false,
    error: selfDelete.error || "Unable to delete account",
  };
}

export async function updateMyProfileName(name: string): Promise<ApiResponse<{ name: string }>> {
  const response = await updateMyProfile({ name });
  if (!response.success || !response.data) {
    return response as ApiResponse<{ name: string }>;
  }

  return {
    success: true,
    data: {
      name: response.data.name,
    },
    statusCode: response.statusCode,
  };
}

function mapProfileResponse(identity: AuthIdentity): {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  subjectType: "user" | "admin";
  isAdmin: boolean;
  adminUserId?: string;
  userId?: string;
} {
  return {
    id: identity.id,
    phone: identity.phone,
    name: identity.name,
    email: identity.email || null,
    subjectType: identity.subjectType,
    isAdmin: identity.isAdmin,
    adminUserId: identity.adminUserId,
    userId: identity.accountUserId,
  };
}

export async function loadMyProfile(): Promise<ApiResponse<ReturnType<typeof mapProfileResponse>>> {
  const token = String(getAuthToken() || "").trim();
  if (!token) {
    return {
      success: false,
      error: "Session expired. Please log in again.",
      statusCode: 401,
    };
  }

  const meResponse = await client.getAuthMeIdentity(token);
  if (!meResponse.success || !meResponse.data) {
    return {
      success: false,
      error: meResponse.error || "Unable to load your profile right now.",
      statusCode: meResponse.statusCode,
    };
  }

  const normalized = normalizeAuthIdentity(
    {
      ...(meResponse.data as AnyRecord),
      accessToken: token,
    },
    {
      requireToken: true,
      source: "GET /auth/me response",
    },
  );

  if (!normalized.identity) {
    return {
      success: false,
      error: normalized.error || "Profile response metadata was incomplete.",
      statusCode: 500,
    };
  }

  persistAuthIdentity(normalized.identity);

  return {
    success: true,
    data: mapProfileResponse(normalized.identity),
    statusCode: meResponse.statusCode,
  };
}

export async function updateMyProfile(payload: {
  name?: string;
  email?: string | null;
}): Promise<ApiResponse<ReturnType<typeof mapProfileResponse>>> {
  const token = String(getAuthToken() || "").trim();
  if (!token) {
    return {
      success: false,
      error: "Session expired. Please log in again.",
      statusCode: 401,
    };
  }

  let patchResponse = await client.updateAuthMeProfile(payload);
  if (!patchResponse.success && patchResponse.statusCode === 422 && isMissingFieldValidationError(patchResponse.error)) {
    const retryPayload: { name?: string; email?: string | null } = { ...payload };
    let shouldRetry = false;

    if (retryPayload.name === undefined) {
      const currentName = String(getUserName() || "").trim();
      if (currentName.length >= 2) {
        retryPayload.name = currentName;
        shouldRetry = true;
      }
    }

    if (retryPayload.email === undefined) {
      const currentEmail = String(getUserEmail() || "").trim().toLowerCase();
      retryPayload.email = currentEmail || null;
      shouldRetry = true;
    }

    if (shouldRetry) {
      patchResponse = await client.updateAuthMeProfile(retryPayload);
    }
  }

  if (!patchResponse.success) {
    return {
      success: false,
      error: patchResponse.error || "Unable to update your profile right now.",
      statusCode: patchResponse.statusCode,
    };
  }

  const patchData = extractApiData<any>(patchResponse) || {};
  let normalized = normalizeAuthIdentity(
    {
      ...(patchData as AnyRecord),
      accessToken: token,
    },
    {
      requireToken: true,
      source: "PATCH /auth/me response",
      fallbackName: payload.name,
    },
  );

  try {
    const meResponse = await client.getAuthMeIdentity(token);
    if (meResponse.success && meResponse.data) {
      normalized = normalizeAuthIdentity(
        {
          ...(meResponse.data as AnyRecord),
          accessToken: token,
        },
        {
          requireToken: true,
          source: "PATCH /auth/me reconcile response",
          fallbackName: payload.name,
        },
      );
    }
  } catch {
    // Keep the PATCH response when /auth/me refresh is temporarily unavailable.
  }

  if (!normalized.identity) {
    return {
      success: false,
      error: normalized.error || "Profile update succeeded but response metadata was incomplete.",
      statusCode: 500,
    };
  }

  persistAuthIdentity(normalized.identity);

  return {
    success: true,
    data: mapProfileResponse(normalized.identity),
    statusCode: patchResponse.statusCode,
  };
}

export async function getPopularDestinations(): Promise<ApiResponse<any[]>> {
  return getCachedResource(
    POPULAR_DESTINATIONS_CACHE_KEY,
    CATALOG_CACHE_TTL_MS,
    async () => {
      const response = await client.getPopularDestinations();
      if (!response.success) {
        return response as ApiResponse<any[]>;
      }

      const rows = Array.isArray(response.data) ? response.data : [];
      return { success: true, data: rows.map(normalizePopularDestination) };
    },
    { shouldCache: (response) => Boolean(response.success) },
  );
}

export async function getAllDestinations(): Promise<ApiResponse<any[]>> {
  return getCachedResource(
    ALL_DESTINATIONS_CACHE_KEY,
    CATALOG_CACHE_TTL_MS,
    async () => {
      const response = await client.getDestinations();
      if (!response.success) {
        return response as ApiResponse<any[]>;
      }

      const rows = Array.isArray(response.data) ? response.data : [];
      return { success: true, data: rows.map(normalizeDestination) };
    },
    { shouldCache: (response) => Boolean(response.success) },
  );
}

export async function getCountryPlans(countryCode: string): Promise<ApiResponse<any[]>> {
  const response = await client.getCountryPlans(countryCode);
  if (!response.success) {
    return response as ApiResponse<any[]>;
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  return { success: true, data: rows.map(normalizePlan) };
}

export async function getRegionPlans(regionCode: string): Promise<ApiResponse<any[]>> {
  const response = await client.getRegionPlans(regionCode);
  if (!response.success) {
    return response as ApiResponse<any[]>;
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  return { success: true, data: rows.map(normalizePlan) };
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
  const amount = Math.max(0, convertUsdToIqd(usdPrice, settings.exchangeRate, settings.markupPercent));
  if (amount <= 0) {
    return {
      success: false,
      error: "Plan price is not configured for checkout.",
    };
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
  const description = `eSIM ${String(checkout?.country?.name || "Plan")} ${String(checkout?.plan?.data || "")}GB`;

  savePendingOrder(purchasePayload);

  const successUrl = getCheckoutReturnUrl("success");
  const cancelUrl = getCheckoutReturnUrl("cancelled");
  const response = await client.createFibPayment({
    amount,
    description,
    returnUrl: successUrl,
    successUrl,
    cancelUrl,
    redirectUrl: successUrl,
    callbackUrl: successUrl,
    metadata: {
      transactionId,
      planId,
      // Keep user reference for auditing without triggering strict DB FK expectations in FIB checkout.
      customerUserId: payload.userId,
      countryCode: payload?.country?.code || "",
      autoTopUp: Boolean(autoTopUp),
    },
  });
  if (!response.success) {
    clearPendingOrder();
    return {
      success: false,
      error: response.error || "Unable to create FIB payment",
    };
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

export async function purchaseWithLoyalty(planId: string, autoTopUp = false): Promise<ApiResponse<any>> {
  const authError = requireUserId();
  if (authError) {
    return authError;
  }

  const payload = buildPurchasePayload(planId, autoTopUp);
  const checkout = getCheckoutData();
  const usdPrice = toNumber(checkout?.plan?.price, 0);
  const settings = await resolveCurrencySettingsForCheckout();
  const amount = Math.max(0, convertUsdToIqd(usdPrice, settings.exchangeRate, settings.markupPercent));
  if (amount <= 0) {
    return {
      success: false,
      error: "Plan price is not configured for checkout.",
    };
  }
  const transactionId = createPurchaseTransactionId("LOYALTY");
  const response = await client.purchaseLoyalty({
    ...payload,
    transactionId,
    amountIqd: amount,
    providerPriceUsd: usdPrice,
    exchangeRate: toNumber(settings.exchangeRate, 0),
    markupPercent: toNumber(settings.markupPercent, 0),
    paymentMethod: "loyalty",
    paymentStatus: "approved",
  });

  if (!response.success) {
    return {
      success: false,
      error: response.error || "Unable to complete loyalty purchase",
    };
  }

  return response;
}

export async function completePendingPurchase(paymentMeta?: AnyRecord): Promise<ApiResponse<any>> {
  const authError = requireUserId();
  if (authError) {
    return authError;
  }

  const pending = readPendingOrder();
  if (!pending) {
    return {
      success: true,
      data: {
        skipped: true,
        reason: "No pending payment found.",
      },
    };
  }

  const response = await client.purchaseComplete({
    ...pending,
    ...(paymentMeta || {}),
  });

  if (response.success) {
    clearPendingOrder();
  }

  return response;
}

export async function getLoyaltyStatus(): Promise<ApiResponse<{ hasAccess: boolean }>> {
  const userId = getStoredUserId();
  const response = await client.getLoyaltyStatus(userId || undefined);
  if (!response.success) {
    return response as ApiResponse<{ hasAccess: boolean }>;
  }

  const data = extractApiData<any>(response) || {};
  return {
    success: true,
    data: {
      hasAccess: Boolean(data?.hasAccess),
    },
  };
}

export async function getMyEsims(): Promise<ApiResponse<any[]>> {
  const response = await client.getMyEsims();
  if (!response.success) {
    return response as ApiResponse<any[]>;
  }
  return { success: true, data: Array.isArray(response.data) ? response.data : [] };
}

export async function activateEsim(esimId: string, iccid?: string, esimTranNo?: string): Promise<ApiResponse<any>> {
  const authError = requireUserId();
  if (authError) {
    return authError;
  }

  return client.activateEsim(esimId, { userId: getStoredUserId(), iccid, esimTranNo });
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

  const makeTransactionId = () => {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `TOPUP-${stamp}-${random}`;
  };

  return client.topupEsim(esimId, {
    userId: getStoredUserId(),
    planId,
    packageCode: planId,
    transactionId: options?.transactionId || makeTransactionId(),
    esimTranNo: options?.esimTranNo,
    iccid: options?.iccid,
  });
}

export async function getAdminPopularDestinations(): Promise<ApiResponse<string[]>> {
  const response = await client.getAdminFeaturedLocationCodes();
  if (!response.success) {
    return response as ApiResponse<string[]>;
  }

  const codes = (response.data || [])
    .map((item: AnyRecord | string) =>
      typeof item === "string"
        ? item.trim().toUpperCase()
        : String(item?.code || item?.iso || item?.country_code || "").trim().toUpperCase(),
    )
    .filter(Boolean);

  return { success: true, data: codes };
}

export async function setAdminPopularDestinations(countryCodes: string[]): Promise<ApiResponse<any>> {
  const response = await client.setPopularDestinations(countryCodes);
  if (!response.success) {
    return response;
  }

  invalidateCachedResource(POPULAR_DESTINATIONS_CACHE_KEY);

  const normalizedCodes = countryCodes
    .map((code) => String(code || "").trim().toUpperCase())
    .filter((code) => code.length === 2);

  try {
    localStorage.setItem(HOME_POPULAR_CODES_CACHE_KEY, JSON.stringify(normalizedCodes));
    localStorage.removeItem(HOME_POPULAR_CONTENT_CACHE_KEY);
  } catch {
    // Ignore storage failures.
  }

  return {
    success: true,
    data: {
      message: "Popular destinations updated",
      codes: normalizedCodes,
    },
  };
}

export async function clearAdminPopularDestinations(): Promise<ApiResponse<any>> {
  const response = await client.clearPopularDestinations();
  if (!response.success) {
    return response;
  }

  invalidateCachedResource(POPULAR_DESTINATIONS_CACHE_KEY);

  try {
    localStorage.setItem(HOME_POPULAR_CODES_CACHE_KEY, JSON.stringify([]));
    localStorage.removeItem(HOME_POPULAR_CONTENT_CACHE_KEY);
  } catch {
    // Ignore storage failures.
  }

  return {
    success: true,
    data: {
      message: "Popular destinations cleared",
    },
  };
}

export async function getCurrencySettings(): Promise<ApiResponse<any>> {
  return getCachedResource(CURRENCY_SETTINGS_CACHE_KEY, SETTINGS_CACHE_TTL_MS, async () => {
    const response = await client.getCurrencySettings();
    if (!response.success) {
      return {
        success: true,
        data: {
          enableIQD: false,
          exchangeRate: "1320",
          markupPercent: "0",
        },
      };
    }

    const data = extractApiData<any>(response) || {};
    return {
      success: true,
      data: {
        enableIQD: toBoolean(data?.enableIQD ?? data?.enable_iqd, false),
        exchangeRate: String(toNumber(data?.exchangeRate ?? data?.exchange_rate ?? data?.rate, 1320)),
        markupPercent: String(toNumber(data?.markupPercent ?? data?.markup_percent ?? data?.markup, 0)),
      },
    };
  });
}

export async function updateCurrencySettings(settings: AnyRecord): Promise<ApiResponse<any>> {
  const response = await client.updateCurrencySettings({
    enableIQD: Boolean(settings?.enableIQD),
    exchangeRate: String(settings?.exchangeRate || "1320"),
    markupPercent: String(settings?.markupPercent || "0"),
  });

  if (!response.success) {
    return response;
  }

  invalidateCachedResource(CURRENCY_SETTINGS_CACHE_KEY);
  return getCurrencySettings();
}

export async function getWhitelistSettings(): Promise<ApiResponse<any>> {
  return getCachedResource(WHITELIST_SETTINGS_CACHE_KEY, SETTINGS_CACHE_TTL_MS, async () => {
    const response = await client.getWhitelistSettings();
    if (!response.success) {
      return {
        success: true,
        data: {
          enabled: false,
          codes: [],
        },
      };
    }

    const data = extractApiData<any>(response) || {};
    return {
      success: true,
      data: {
        enabled: Boolean(data?.enabled),
        codes: Array.isArray(data?.codes)
          ? data.codes.map((code: any) => String(code).trim().toUpperCase()).filter(Boolean)
          : [],
      },
    };
  });
}

export async function updateWhitelistSettings(settings: AnyRecord): Promise<ApiResponse<any>> {
  const response = await client.updateWhitelistSettings({
    enabled: Boolean(settings?.enabled),
    codes: Array.isArray(settings?.codes)
      ? settings.codes.map((code: any) => String(code).trim().toUpperCase()).filter(Boolean)
      : [],
  });

  if (!response.success) {
    return response;
  }

  invalidateCachedResource(WHITELIST_SETTINGS_CACHE_KEY);
  return getWhitelistSettings();
}

export async function getPushNotificationSummary(): Promise<ApiResponse<any>> {
  return client.getPushNotificationSummary(getAdminPhone());
}

export async function getPushNotificationDiagnostics(): Promise<ApiResponse<any>> {
  return client.getPushNotificationDiagnostics(getAdminPhone());
}

export async function sendPushNotification(payload: {
  title: string;
  body: string;
  route?: string;
  audience?: string;
  kind?: string;
  userIds?: string[];
  tokens?: string[];
}): Promise<ApiResponse<any>> {
  const diagnostics = await getPushNotificationDiagnostics();
  if (diagnostics.success) {
    const activePushDevices = Number(
      diagnostics.data?.activePushDevices ??
        diagnostics.data?.enabledDevices ??
        0,
    );

    if (!Number.isFinite(activePushDevices) || activePushDevices <= 0) {
      return {
        success: false,
        error: "No devices registered. Open the mobile app, allow notifications, and log in first.",
      };
    }
  }

  return client.sendPushNotification({
    adminPhone: getAdminPhone(),
    title: String(payload.title || "").trim(),
    body: String(payload.body || "").trim(),
    route: String(payload.route || "").trim(),
    audience:
      payload.audience === null || payload.audience === undefined
        ? undefined
        : String(payload.audience || "").trim(),
    kind: String(payload.kind || "").trim(),
    userIds: Array.isArray(payload.userIds)
      ? payload.userIds.map((id: any) => String(id || "").trim()).filter(Boolean)
      : [],
    tokens: Array.isArray(payload.tokens)
      ? payload.tokens.map((token: any) => String(token || "").trim()).filter(Boolean)
      : [],
  });
}

export async function sendAppUpdatePushNotification(payload: {
  title: string;
  body: string;
  appStoreUrl: string;
  playStoreUrl: string;
  audience?: string;
  dryRun?: boolean;
}): Promise<ApiResponse<any>> {
  const diagnostics = await getPushNotificationDiagnostics();
  if (diagnostics.success) {
    const activePushDevices = Number(
      diagnostics.data?.activePushDevices ??
        diagnostics.data?.enabledDevices ??
        0,
    );

    if (!Number.isFinite(activePushDevices) || activePushDevices <= 0) {
      return {
        success: false,
        error: "No devices registered. Open the mobile app, allow notifications, and log in first.",
      };
    }
  }

  return client.sendAppUpdatePushNotification({
    title: String(payload.title || "").trim(),
    body: String(payload.body || "").trim(),
    appStoreUrl: String(payload.appStoreUrl || "").trim(),
    playStoreUrl: String(payload.playStoreUrl || "").trim(),
    audience: String(payload.audience || "all").trim() || "all",
    dryRun: Boolean(payload.dryRun),
  });
}

export async function getSuperAdmins(): Promise<ApiResponse<any[]>> {
  return getCachedResource(
    SUPER_ADMINS_CACHE_KEY,
    SETTINGS_CACHE_TTL_MS,
    async () => {
      const response = await client.listSuperAdmins(getAdminPhone());
      if (!response.success) {
        return response as ApiResponse<any[]>;
      }

      const raw = Array.isArray(response.data) ? response.data : [];
      const data = raw
        .filter((entry: any) => String(entry?.status || "active").trim().toLowerCase() === "active")
        .map((entry: any) => {
        if (typeof entry === "string") {
          return {
            phone: entry,
            name: "Admin User",
          };
        }

        return {
          phone: String(entry?.phone || "").trim(),
          name: String(entry?.name || "Admin User"),
        };
        });

      return { success: true, data };
    },
    { shouldCache: (response) => Boolean(response.success) },
  );
}

export async function addSuperAdmin(phone: string, _name: string): Promise<ApiResponse<any>> {
  const response = await client.addSuperAdmin(getAdminPhone(), phone);
  if (!response.success) {
    return response;
  }

  invalidateCachedResource(SUPER_ADMINS_CACHE_KEY);
  const next = await getSuperAdmins();
  if (!next.success) {
    return next;
  }

  const added = (next.data || []).find((admin: AnyRecord) => String(admin?.phone) === String(phone));
  return {
    success: true,
    data: added || { phone, name: "Admin User" },
  };
}

export async function removeSuperAdmin(phone: string): Promise<ApiResponse<any>> {
  const response = await client.removeSuperAdmin(getAdminPhone(), phone);
  if (!response.success) {
    return response;
  }

  invalidateCachedResource(SUPER_ADMINS_CACHE_KEY);

  return {
    success: true,
    data: {
      phone,
      message: "Admin removed",
    },
  };
}

export async function getUsers(): Promise<ApiResponse<any[]>> {
  const response = await client.listUsers(getAdminPhone(), { includeDeleted: false });
  if (!response.success) {
    return response as ApiResponse<any[]>;
  }

  const rows = Array.isArray(response.data) ? response.data : [];
  const data = rows.map((entry: any, index: number) => {
    const status = String(
      entry?.status ||
      entry?.userStatus ||
      entry?.user_status ||
      entry?.accountStatus ||
      entry?.account_status ||
      "",
    ).trim().toLowerCase();
    const id = String(entry?.id || entry?.userId || entry?._id || `user-${index + 1}`);
    const name = String(entry?.name || entry?.fullName || entry?.username || "User");
    const phone = String(entry?.phone || entry?.phoneNumber || entry?.mobile || "");
    const createdAt = String(entry?.createdAt || entry?.created_at || "");
    const blockedFromStatus = status === "inactive" || status === "blocked";

    if (status === "deleted" || status === "soft_deleted" || status === "soft-deleted") {
      return null;
    }

    return {
      id,
      name,
      phone,
      createdAt,
      status,
      isBlocked: Boolean(
        entry?.isBlocked ??
        entry?.blocked ??
        entry?.is_disabled ??
        entry?.disabled ??
        blockedFromStatus
      ),
      hasLoyalty: Boolean(
        entry?.hasLoyalty ??
        entry?.loyaltyEnabled ??
        entry?.loyaltyGranted ??
        entry?.loyalty ??
        false
      ),
      raw: entry,
    };
  }).filter(Boolean);

  return { success: true, data };
}

export async function deleteUserAccount(userId: string): Promise<ApiResponse<any>> {
  return client.deleteUser(String(userId || "").trim(), getAdminPhone());
}

export async function grantUserLoyalty(userId: string, granted = true): Promise<ApiResponse<any>> {
  return client.grantLoyalty({
    adminPhone: getAdminPhone(),
    userId: String(userId || "").trim(),
    granted: Boolean(granted),
  });
}

export async function blockUserAccount(userId: string, blocked = true): Promise<ApiResponse<any>> {
  const id = String(userId || "").trim();
  if (!id) {
    return { success: false, error: "Missing user id" };
  }

  return client.setUserBlocked({
    adminPhone: getAdminPhone(),
    userId: id,
    blocked: Boolean(blocked),
  });
}

export async function editUserAccount(
  userId: string,
  payload: { name?: string; phone?: string },
): Promise<ApiResponse<any>> {
  const id = String(userId || "").trim();
  if (!id) {
    return { success: false, error: "Missing user id" };
  }
  const nextName = String(payload?.name || "").trim();
  const nextPhone = String(payload?.phone || "").trim();

  if (!nextName && !nextPhone) {
    return { success: false, error: "Name or phone is required." };
  }

  return client.editUser({
    adminPhone: getAdminPhone(),
    userId: id,
    ...(nextName ? { name: nextName } : {}),
    ...(nextPhone ? { phone: nextPhone } : {}),
  });
}

export async function isSuperAdmin(phone: string): Promise<ApiResponse<boolean>> {
  const response = await client.checkSuperAdmin(phone);
  if (!response.success) {
    return {
      success: false,
      error: response.error || "Unable to check super admin",
    };
  }

  const data = extractApiData<any>(response);
  const value = typeof data === "boolean" ? data : Boolean(data?.isSuperAdmin);

  return {
    success: true,
    data: value,
  };
}
