import { requestApi } from "./http";
import { clearAuthSession, setAuthSession } from "./session";
import type { ApiResponse, AnyRecord } from "./types";

const AUTH_REQUEST_TIMEOUT_MS = 30_000;
const AUTH_ME_PATH = "/auth/me";
const USER_OTP_REQUEST_PATH = "/auth/user/otp/request";
const ADMIN_OTP_REQUEST_PATH = "/auth/admin/otp/request";
const USER_SIGNUP_PATH = "/auth/user/signup";
const USER_LOGIN_PATH = "/auth/user/login";
const ADMIN_LOGIN_PATH = "/auth/admin/login";
const USER_FORGOT_RESET_PATH = "/auth/user/password/forgot/reset";
const ADMIN_FORGOT_RESET_PATH = "/auth/admin/password/forgot/reset";

export type OtpChannel = "sms" | "whatsapp";

interface AuthIdentity {
  token: string;
  id: string;
  userId?: string;
  phone: string;
  name: string;
  email?: string;
  subjectType: "user" | "admin";
  isAdmin: boolean;
  adminUserId?: string;
  accountUserId?: string;
}

function toTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeInternationalPhone(value: unknown): string {
  const raw = toTrimmedString(value);
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/\s+/g, "");
  if (compact.startsWith("+")) {
    return `+${compact.slice(1).replace(/\D/g, "")}`;
  }
  return `+${compact.replace(/\D/g, "")}`;
}

function buildPhoneFallbackCandidates(phone: string): string[] {
  const normalized = normalizeInternationalPhone(phone);
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (value: string) => {
    const clean = toTrimmedString(value);
    if (!clean || seen.has(clean)) {
      return;
    }
    seen.add(clean);
    candidates.push(clean);
  };

  addCandidate(normalized);
  const digitsOnly = normalized.replace(/^\+/, "");
  if (digitsOnly) {
    addCandidate(digitsOnly);
    addCandidate(`00${digitsOnly}`);
  }

  // Compatibility fallback for Iraq numbers where backend might store/query
  // either +96475... or +964075... forms.
  if (/^\+9640\d+$/.test(normalized)) {
    addCandidate(normalized.replace(/^\+9640/, "+964"));
  } else if (/^\+964\d+$/.test(normalized)) {
    addCandidate(normalized.replace(/^\+964/, "+9640"));
  }

  const iqMatch = normalized.match(/^\+9640?(7\d{9})$/);
  if (iqMatch) {
    addCandidate(`0${iqMatch[1]}`);
  }

  return candidates;
}

async function postWithPhoneFallback(path: string, payload: AnyRecord): Promise<ApiResponse> {
  const candidates = buildPhoneFallbackCandidates(payload.phone);
  if (candidates.length === 0) {
    return requestApi(path, {
      method: "POST",
      includeAuth: false,
      timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
      body: payload,
    });
  }

  let lastResponse: ApiResponse | null = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const response = await requestApi(path, {
      method: "POST",
      includeAuth: false,
      timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
      body: {
        ...payload,
        phone: candidates[index],
      },
    });

    if (response.success) {
      return response;
    }

    lastResponse = response;
    if (response.statusCode !== 404) {
      return response;
    }
  }

  return (
    lastResponse || {
      success: false,
      error: "Unable to complete authentication request.",
      statusCode: 500,
    }
  );
}

async function postWithPhoneAndPathFallback(
  paths: string[],
  payload: AnyRecord,
  fallbackStatuses: number[] = [404],
): Promise<ApiResponse> {
  const normalizedPaths = paths.map((path) => toTrimmedString(path)).filter(Boolean);
  if (normalizedPaths.length === 0) {
    return {
      success: false,
      error: "No auth endpoint path configured.",
      statusCode: 500,
    };
  }

  let lastResponse: ApiResponse | null = null;
  for (let index = 0; index < normalizedPaths.length; index += 1) {
    const response = await postWithPhoneFallback(normalizedPaths[index], payload);
    if (response.success) {
      return response;
    }

    lastResponse = response;
    if (!fallbackStatuses.includes(Number(response.statusCode || 0))) {
      return response;
    }
  }

  return (
    lastResponse || {
      success: false,
      error: "Unable to complete authentication request.",
      statusCode: 500,
    }
  );
}

function unwrapApiData<T = any>(response: ApiResponse<T>): any {
  const data = (response as AnyRecord)?.data;
  if (data !== undefined) {
    if (data && typeof data === "object" && (data as AnyRecord).data !== undefined) {
      return (data as AnyRecord).data;
    }
    if (data && typeof data === "object" && (data as AnyRecord).obj !== undefined) {
      return (data as AnyRecord).obj;
    }
    return data;
  }

  if ((response as AnyRecord)?.obj !== undefined) {
    return (response as AnyRecord).obj;
  }

  return null;
}

function normalizeStrictSubjectType(raw: unknown): "user" | "admin" | "" {
  const value = toTrimmedString(raw).toLowerCase();
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

  const value = toTrimmedString(raw).toLowerCase();
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return undefined;
}

function resolveAuthToken(payload: any): string {
  return toTrimmedString(payload?.accessToken || payload?.access_token || payload?.token);
}

function normalizeAuthIdentity(
  payload: any,
  options: {
    source: string;
    fallbackPhone?: string;
    fallbackName?: string;
    tokenOverride?: string;
  },
): { identity?: AuthIdentity; error?: string } {
  const token = toTrimmedString(options.tokenOverride || resolveAuthToken(payload));
  if (!token) {
    return { error: `${options.source} did not return accessToken.` };
  }

  const subjectType = normalizeStrictSubjectType(payload?.subjectType ?? payload?.subject_type);
  const isAdminValue = parseAuthBoolean(payload?.isAdmin ?? payload?.is_admin);
  const resolvedSubjectType: "user" | "admin" | "" =
    subjectType === "admin" || isAdminValue === true
      ? "admin"
      : subjectType === "user" || isAdminValue === false
      ? "user"
      : "";

  if (!resolvedSubjectType) {
    return {
      error: `${options.source} is missing role metadata (subjectType/isAdmin).`,
    };
  }

  const id = toTrimmedString(
    payload?.id || payload?.userId || payload?.user_id || payload?.adminUserId || payload?.admin_user_id,
  );
  if (!id) {
    return { error: `${options.source} did not include id.` };
  }

  const userId = toTrimmedString(payload?.userId || payload?.user_id);
  const adminUserId = toTrimmedString(payload?.adminUserId || payload?.admin_user_id);
  const accountUserId = resolvedSubjectType === "user" ? toTrimmedString(userId || id) : "";
  const phone = normalizeInternationalPhone(payload?.phone || options.fallbackPhone);
  const name = toTrimmedString(
    payload?.name || options.fallbackName || phone || accountUserId || adminUserId || id,
  );
  const email = toTrimmedString(payload?.email || "");

  return {
    identity: {
      token,
      id,
      userId: userId || undefined,
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

function toSessionResponse(identity: AuthIdentity): { userId: string; phone: string; name: string } {
  return {
    userId: identity.accountUserId || identity.userId || identity.adminUserId || identity.id,
    phone: identity.phone,
    name: identity.name,
  };
}

function hasIdentityMismatch(left: AuthIdentity, right: AuthIdentity): boolean {
  return (
    left.id !== right.id
    || String(left.userId || "") !== String(right.userId || "")
    || String(left.accountUserId || "") !== String(right.accountUserId || "")
    || String(left.adminUserId || "") !== String(right.adminUserId || "")
    || left.phone !== right.phone
    || left.name !== right.name
    || left.subjectType !== right.subjectType
    || left.isAdmin !== right.isAdmin
  );
}

async function reconcileAuthMeIdentity(identity: AuthIdentity): Promise<{
  identity?: AuthIdentity;
  error?: string;
  statusCode?: number;
}> {
  const authMeResponse = await requestApi(AUTH_ME_PATH, {
    includeAuth: false,
    headers: {
      Authorization: `Bearer ${identity.token}`,
    },
    timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
  });

  if (!authMeResponse.success) {
    if (authMeResponse.statusCode === 401) {
      clearAuthSession();
      return {
        error: authMeResponse.error || "Session is invalid. Please log in again.",
        statusCode: 401,
      };
    }
    if (authMeResponse.statusCode === 403) {
      clearAuthSession();
      return {
        error: authMeResponse.error || "This account is inactive or forbidden.",
        statusCode: 403,
      };
    }

    // Best-effort reconcile: keep auth session when /auth/me is temporarily unavailable.
    return { identity };
  }

  const authMeData = unwrapApiData(authMeResponse) || authMeResponse.data || {};
  const reconciled = normalizeAuthIdentity(
    {
      ...(authMeData as AnyRecord),
      accessToken: identity.token,
    },
    {
      source: "GET /auth/me response",
      fallbackPhone: identity.phone,
      fallbackName: identity.name,
      tokenOverride: identity.token,
    },
  );

  if (!reconciled.identity) {
    clearAuthSession();
    return {
      error: reconciled.error || "Invalid role/session metadata from /auth/me.",
      statusCode: 403,
    };
  }

  return { identity: reconciled.identity };
}

async function completeAuthSession(
  response: ApiResponse,
  fallback: {
    phone: string;
    name?: string;
  },
  source: string,
): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  if (!response.success) {
    return {
      success: false,
      error: response.error || `${source} failed`,
      statusCode: response.statusCode,
    };
  }

  const data = unwrapApiData(response) || response.data || {};
  const normalized = normalizeAuthIdentity(data, {
    source,
    fallbackPhone: fallback.phone,
    fallbackName: fallback.name,
  });

  if (!normalized.identity) {
    return {
      success: false,
      error: normalized.error || `${source} returned invalid session payload.`,
      statusCode: 500,
    };
  }

  let identity = normalized.identity;
  persistAuthIdentity(identity);

  void reconcileAuthMeIdentity(identity)
    .then((reconciled) => {
      if (reconciled.identity && hasIdentityMismatch(identity, reconciled.identity)) {
        persistAuthIdentity(reconciled.identity);
      }
    })
    .catch((error) => {
      console.warn("Auth session background reconcile skipped:", error);
    });

  return {
    success: true,
    data: toSessionResponse(identity),
    statusCode: response.statusCode,
  };
}

export async function requestUserOtp(phone: string, channel: OtpChannel): Promise<ApiResponse<{
  to: string;
  channel: OtpChannel;
  status: string;
  sid?: string;
}>> {
  const normalizedPhone = normalizeInternationalPhone(phone);
  const normalizedChannel: OtpChannel = channel === "whatsapp" ? "whatsapp" : "sms";

  const response = await postWithPhoneAndPathFallback(
    [USER_OTP_REQUEST_PATH, ADMIN_OTP_REQUEST_PATH],
    {
      phone: normalizedPhone,
      channel: normalizedChannel,
    },
    [404, 405],
  );

  if (!response.success) {
    return {
      success: false,
      error: response.error || "Unable to request OTP.",
      statusCode: response.statusCode,
    };
  }

  const data = unwrapApiData(response) || response.data || {};
  const responseChannel: OtpChannel =
    toTrimmedString(data?.channel).toLowerCase() === "whatsapp" ? "whatsapp" : "sms";

  return {
    success: true,
    data: {
      to: normalizeInternationalPhone(data?.to || normalizedPhone),
      channel: responseChannel,
      status: toTrimmedString(data?.status || "pending"),
      sid: toTrimmedString(data?.sid || "") || undefined,
    },
    statusCode: response.statusCode,
  };
}

export async function signupWithOtp(
  phone: string,
  name: string,
  otpCode: string,
  channel?: OtpChannel,
): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const normalizedPhone = normalizeInternationalPhone(phone);
  const normalizedName = toTrimmedString(name);

  const response = await requestApi(USER_SIGNUP_PATH, {
    method: "POST",
    includeAuth: false,
    timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
    body: {
      phone: normalizedPhone,
      name: normalizedName,
      otpCode: toTrimmedString(otpCode),
      ...(channel ? { channel } : {}),
    },
  });

  return completeAuthSession(response, { phone: normalizedPhone, name: normalizedName }, "Signup response");
}

export async function signupWithPassword(
  phone: string,
  name: string,
  password: string,
): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const normalizedPhone = normalizeInternationalPhone(phone);
  const normalizedName = toTrimmedString(name);

  const response = await requestApi(USER_SIGNUP_PATH, {
    method: "POST",
    includeAuth: false,
    timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
    body: {
      phone: normalizedPhone,
      name: normalizedName,
      password: toTrimmedString(password),
    },
  });

  return completeAuthSession(response, { phone: normalizedPhone, name: normalizedName }, "Signup response");
}

export async function loginWithOtp(
  phone: string,
  otpCode: string,
  channel?: OtpChannel,
): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const normalizedPhone = normalizeInternationalPhone(phone);

  const response = await postWithPhoneAndPathFallback(
    [USER_LOGIN_PATH, ADMIN_LOGIN_PATH],
    {
      phone: normalizedPhone,
      otpCode: toTrimmedString(otpCode),
      ...(channel ? { channel } : {}),
    },
    [404],
  );

  return completeAuthSession(response, { phone: normalizedPhone }, "Login response");
}

export async function loginWithPassword(
  phone: string,
  password: string,
): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const normalizedPhone = normalizeInternationalPhone(phone);

  const response = await postWithPhoneAndPathFallback(
    [USER_LOGIN_PATH, ADMIN_LOGIN_PATH],
    {
      phone: normalizedPhone,
      password: toTrimmedString(password),
    },
    [404],
  );

  return completeAuthSession(response, { phone: normalizedPhone }, "Login response");
}

export async function resetPasswordWithOtp(
  phone: string,
  otpCode: string,
  newPassword: string,
  channel?: OtpChannel,
): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const normalizedPhone = normalizeInternationalPhone(phone);

  const response = await postWithPhoneAndPathFallback(
    [USER_FORGOT_RESET_PATH, ADMIN_FORGOT_RESET_PATH],
    {
      phone: normalizedPhone,
      otpCode: toTrimmedString(otpCode),
      newPassword: toTrimmedString(newPassword),
      ...(channel ? { channel } : {}),
    },
    [404],
  );

  return completeAuthSession(response, { phone: normalizedPhone }, "Forgot-password reset response");
}

export function signup(
  phone: string,
  name: string,
  password?: string,
): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const normalizedPassword = toTrimmedString(password);
  if (!normalizedPassword) {
    return Promise.resolve({
      success: false,
      error: "Password is required for this sign-up method.",
      statusCode: 422,
    });
  }
  return signupWithPassword(phone, name, normalizedPassword);
}

export function login(
  phone: string,
  password?: string,
): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const normalizedPassword = toTrimmedString(password);
  if (!normalizedPassword) {
    return Promise.resolve({
      success: false,
      error: "Password is required for this login method.",
      statusCode: 422,
    });
  }
  return loginWithPassword(phone, normalizedPassword);
}
