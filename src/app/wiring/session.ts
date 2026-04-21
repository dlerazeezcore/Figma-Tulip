const AUTH_TOKEN_KEY = "authToken";
const USER_ID_KEY = "userId";
const AUTH_ID_KEY = "authId";
const ADMIN_USER_ID_KEY = "adminUserId";
const ACCOUNT_USER_ID_KEY = "accountUserId";
const USER_PHONE_KEY = "userPhone";
const USER_NAME_KEY = "userName";
const USER_EMAIL_KEY = "userEmail";
const USER_DIAL_CODE_KEY = "userDialCode";
const IS_ADMIN_KEY = "isAdmin";
const AUTH_SUBJECT_TYPE_KEY = "authSubjectType";
const AUTH_SESSION_CHANGED_EVENT = "auth-session-changed";

function read(key: string): string {
  try {
    return String(localStorage.getItem(key) || "");
  } catch {
    return "";
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function emitAuthSessionChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
  } catch {
    // Ignore event dispatch failures.
  }
}

export function getAuthToken(): string {
  return read(AUTH_TOKEN_KEY);
}

export function getUserId(): string {
  return read(USER_ID_KEY);
}

export function getAuthId(): string {
  return read(AUTH_ID_KEY) || getUserId();
}

export function getAdminUserId(): string {
  return read(ADMIN_USER_ID_KEY);
}

export function getAccountUserId(): string {
  return read(ACCOUNT_USER_ID_KEY);
}

export function getUserPhone(): string {
  return read(USER_PHONE_KEY);
}

export function getUserName(): string {
  return read(USER_NAME_KEY);
}

export function getUserEmail(): string {
  return read(USER_EMAIL_KEY);
}

export function setUserName(name: string): void {
  write(USER_NAME_KEY, name);
  emitAuthSessionChanged();
}

export function getAuthSubjectType(): "user" | "admin" | "" {
  const value = read(AUTH_SUBJECT_TYPE_KEY).trim().toLowerCase();
  if (value === "user" || value === "admin") {
    return value;
  }
  return "";
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken() && getAuthId());
}

export function isAdmin(): boolean {
  const value = read(IS_ADMIN_KEY).trim().toLowerCase();
  return value === "1" || value === "true";
}

export function setAdminAccess(value: boolean): void {
  write(IS_ADMIN_KEY, value ? "1" : "0");
  write(AUTH_SUBJECT_TYPE_KEY, value ? "admin" : "user");
  emitAuthSessionChanged();
}

export function setAuthSession(payload: {
  token: string;
  userId: string;
  id?: string;
  adminUserId?: string;
  accountUserId?: string;
  phone?: string;
  name?: string;
  email?: string | null;
  userDialCode?: string;
  isAdmin?: boolean;
  subjectType?: "user" | "admin";
}): void {
  const token = String(payload.token || "").trim();
  const canonicalId = String(payload.id || payload.userId || "").trim();

  if (token) {
    write(AUTH_TOKEN_KEY, token);
  }
  if (canonicalId) {
    write(USER_ID_KEY, canonicalId);
    write(AUTH_ID_KEY, canonicalId);
  }

  const adminUserId = String(payload.adminUserId || "").trim();
  if (adminUserId) {
    write(ADMIN_USER_ID_KEY, adminUserId);
  } else {
    remove(ADMIN_USER_ID_KEY);
  }

  const accountUserId = String(payload.accountUserId || "").trim();
  if (accountUserId) {
    write(ACCOUNT_USER_ID_KEY, accountUserId);
  } else {
    remove(ACCOUNT_USER_ID_KEY);
  }
  if (payload.phone) {
    write(USER_PHONE_KEY, String(payload.phone));
  }
  if (payload.name) {
    write(USER_NAME_KEY, String(payload.name));
  }
  if (payload.email !== undefined) {
    const email = String(payload.email || "").trim();
    if (email) {
      write(USER_EMAIL_KEY, email);
    } else {
      remove(USER_EMAIL_KEY);
    }
  }
  if (payload.userDialCode) {
    write(USER_DIAL_CODE_KEY, String(payload.userDialCode));
  }
  if (typeof payload.isAdmin === "boolean") {
    write(IS_ADMIN_KEY, payload.isAdmin ? "1" : "0");
  } else if (payload.subjectType === "user" || payload.subjectType === "admin") {
    // Keep legacy isAdmin flag aligned with the canonical auth subject.
    write(IS_ADMIN_KEY, payload.subjectType === "admin" ? "1" : "0");
  }
  if (payload.subjectType === "user" || payload.subjectType === "admin") {
    write(AUTH_SUBJECT_TYPE_KEY, payload.subjectType);
  } else if (typeof payload.isAdmin === "boolean") {
    write(AUTH_SUBJECT_TYPE_KEY, payload.isAdmin ? "admin" : "user");
  } else {
    remove(AUTH_SUBJECT_TYPE_KEY);
  }

  emitAuthSessionChanged();
}

export function setAuthToken(token: string, userId: string): void {
  setAuthSession({ token, userId });
}

export function clearAuthSession(): void {
  remove(AUTH_TOKEN_KEY);
  remove(USER_ID_KEY);
  remove(AUTH_ID_KEY);
  remove(ADMIN_USER_ID_KEY);
  remove(ACCOUNT_USER_ID_KEY);
  remove(USER_PHONE_KEY);
  remove(USER_NAME_KEY);
  remove(USER_EMAIL_KEY);
  remove(USER_DIAL_CODE_KEY);
  remove(IS_ADMIN_KEY);
  remove(AUTH_SUBJECT_TYPE_KEY);
  emitAuthSessionChanged();
}

export function addAuthSessionChangeListener(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const wrapped = () => listener();
  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, wrapped);
  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, wrapped);
  };
}
