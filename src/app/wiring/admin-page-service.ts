import { useEffect, useState } from "react";
import { toast } from "sonner";
import { unregisterPushDevice } from "./esim-app-client";
import {
  addSuperAdmin,
  blockUserAccount,
  clearAdminPopularDestinations,
  deleteUserAccount,
  editUserAccount,
  grantUserLoyalty,
  getUsers,
  getAdminPopularDestinations,
  getCurrencySettings,
  getPushNotificationSummary,
  getSuperAdmins,
  getWhitelistSettings,
  removeSuperAdmin,
  sendAppUpdatePushNotification as sendAppUpdatePush,
  sendPushNotification,
  setAdminPopularDestinations,
  getHomeTutorialSettings,
  updateCurrencySettings,
  updateHomeTutorialSettings,
  uploadHomeTutorialAsset,
  updateWhitelistSettings,
} from "./admin-config-service";

export interface AdminLoadResult {
  popularCodes: string[];
  currency: {
    enableIQD: boolean;
    exchangeRate: string;
    markupPercent: string;
  };
  whitelist: {
    enabled: boolean;
    codes: string[];
  };
  admins: string[];
  tutorial: {
    enabled: boolean;
    cardTitle: string;
    cardSubtitle: string;
    modalTitle: string;
    iphoneVideoUrl: string;
    iphoneThumbnailUrl: string;
    iphoneDescription: string;
    iphoneDurationLabel: string;
    androidVideoUrl: string;
    androidThumbnailUrl: string;
    androidDescription: string;
    androidDurationLabel: string;
  };
  push: PushNotificationSummary;
}

export interface SignedUser {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  isBlocked: boolean;
  hasLoyalty: boolean;
}

interface LoadedSignedUser extends SignedUser {
  blockedKnown: boolean;
  loyaltyKnown: boolean;
}

export type PushNotificationAudience = "all" | "authenticated" | "loyalty" | "active_esim" | "admins" | "all_devices";
export type PushNotificationKind = "offers" | "orders" | "support" | "general";

export interface PushNotificationSummary {
  available: boolean;
  error: string;
  providerConfigured: boolean;
  totalDevices: number;
  enabledDevices: number;
  authenticatedDevices: number;
  loyaltyDevices: number;
  activeEsimDevices: number;
  iosDevices: number;
  androidDevices: number;
  lastTitle: string;
  lastSentAt: string;
}

export interface AppUpdatePushResultSummary {
  requestedTokens: number;
  successCount: number;
  failureCount: number;
  sentAt: string;
}

export interface AdminPageModel {
  countryCodes: string;
  currentDestinations: string[];
  loading: boolean;
  loadingCurrent: boolean;
  enableIQD: boolean;
  exchangeRate: string;
  markupPercent: string;
  currencyLoading: boolean;
  whitelistEnabled: boolean;
  whitelistCodes: string;
  currentWhitelist: string[];
  whitelistLoading: boolean;
  newAdminPhone: string;
  currentAdmins: string[];
  adminLoading: boolean;
  tutorialEnabled: boolean;
  tutorialCardTitle: string;
  tutorialCardSubtitle: string;
  tutorialModalTitle: string;
  tutorialIphoneVideoUrl: string;
  tutorialIphoneThumbnailUrl: string;
  tutorialIphoneDescription: string;
  tutorialIphoneDurationLabel: string;
  tutorialAndroidVideoUrl: string;
  tutorialAndroidThumbnailUrl: string;
  tutorialAndroidDescription: string;
  tutorialAndroidDurationLabel: string;
  tutorialLoading: boolean;
  tutorialUploadLoadingPlatform: "" | "iphone-video" | "android-video" | "iphone-thumbnail" | "android-thumbnail";
  pushSummary: PushNotificationSummary;
  pushSummaryLoading: boolean;
  pushSending: boolean;
  pushTitle: string;
  pushBody: string;
  pushRoute: string;
  pushAudience: PushNotificationAudience;
  pushKind: PushNotificationKind;
  pushTargetMode: "audience" | "users";
  pushTargetUserSearch: string;
  pushTargetUserIds: string[];
  pushTargetUserOptions: Array<{ id: string; name: string; phone: string }>;
  setPushTargetMode: (value: "audience" | "users") => void;
  setPushTargetUserSearch: (value: string) => void;
  togglePushTargetUser: (userId: string) => void;
  appUpdateSending: boolean;
  appUpdateTitle: string;
  appUpdateBody: string;
  appUpdateAppStoreUrl: string;
  appUpdatePlayStoreUrl: string;
  appUpdateLastResult: AppUpdatePushResultSummary | null;
  usersLoading: boolean;
  userActionLoadingId: string;
  signedUsers: SignedUser[];
  showSignedUsers: boolean;
  openActionMenuUserId: string;
  deleteDialogOpen: boolean;
  deleteTargetUser: SignedUser | null;
  editDialogOpen: boolean;
  editUserId: string;
  editUserName: string;
  editUserPhone: string;
  setCountryCodes: (value: string) => void;
  setEnableIQD: (value: boolean) => void;
  setExchangeRate: (value: string) => void;
  setMarkupPercent: (value: string) => void;
  setWhitelistEnabled: (value: boolean) => void;
  setWhitelistCodes: (value: string) => void;
  setNewAdminPhone: (value: string) => void;
  setTutorialEnabled: (value: boolean) => void;
  setTutorialCardTitle: (value: string) => void;
  setTutorialCardSubtitle: (value: string) => void;
  setTutorialModalTitle: (value: string) => void;
  setTutorialIphoneVideoUrl: (value: string) => void;
  setTutorialIphoneThumbnailUrl: (value: string) => void;
  setTutorialIphoneDescription: (value: string) => void;
  setTutorialIphoneDurationLabel: (value: string) => void;
  setTutorialAndroidVideoUrl: (value: string) => void;
  setTutorialAndroidThumbnailUrl: (value: string) => void;
  setTutorialAndroidDescription: (value: string) => void;
  setTutorialAndroidDurationLabel: (value: string) => void;
  setPushTitle: (value: string) => void;
  setPushBody: (value: string) => void;
  setPushRoute: (value: string) => void;
  setPushAudience: (value: PushNotificationAudience) => void;
  setPushKind: (value: PushNotificationKind) => void;
  setAppUpdateTitle: (value: string) => void;
  setAppUpdateBody: (value: string) => void;
  setAppUpdateAppStoreUrl: (value: string) => void;
  setAppUpdatePlayStoreUrl: (value: string) => void;
  setOpenActionMenuUserId: (value: string | ((current: string) => string)) => void;
  setDeleteDialogOpen: (value: boolean) => void;
  setDeleteTargetUser: (value: SignedUser | null) => void;
  setEditDialogOpen: (value: boolean) => void;
  setEditUserName: (value: string) => void;
  setEditUserPhone: (value: string) => void;
  handleSave: () => Promise<void>;
  handleClear: () => Promise<void>;
  handleSaveCurrencySettings: () => Promise<void>;
  handleSaveWhitelistSettings: () => Promise<void>;
  handleClearWhitelistSettings: () => Promise<void>;
  handleAddSuperAdmin: () => Promise<void>;
  handleRemoveSuperAdmin: (phone: string) => Promise<void>;
  handleSaveTutorialSettings: () => Promise<void>;
  handleUploadTutorialVideo: (platform: "iphone" | "android", file: File | null) => Promise<void>;
  handleUploadTutorialThumbnail: (platform: "iphone" | "android", file: File | null) => Promise<void>;
  handleSendPushNotification: () => Promise<void>;
  handleSendAppUpdatePushNotification: () => Promise<void>;
  handleToggleSignedUsers: () => Promise<void>;
  handleDeleteSignedUser: (user: SignedUser) => void;
  handleConfirmDeleteSignedUser: () => Promise<void>;
  handleBlockSignedUser: (user: SignedUser) => Promise<void>;
  handleGrantLoyalty: (user: SignedUser) => Promise<void>;
  handleOpenEditUser: (user: SignedUser) => void;
  handleSaveEditedUser: () => Promise<void>;
  notifyUnsupportedUserAction: (message: string) => void;
}

export function parseIsoCodeList(input: string): string[] {
  return String(input || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length === 2);
}

const SIGNED_USERS_SNAPSHOT_KEY = "admin.signedUsers.snapshot.v1";

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes", "y", "enabled", "active", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "disabled", "inactive", "off"].includes(normalized)) return false;
  }
  return undefined;
}

function parseHttpStatusCodeFromError(error: unknown): number | null {
  const message = String(error || "").toLowerCase();
  if (!message) {
    return null;
  }

  const match = message.match(/status\s+(\d{3})/);
  if (match) {
    const code = Number.parseInt(match[1], 10);
    return Number.isFinite(code) ? code : null;
  }
  return null;
}

function readSignedUsersSnapshot(): SignedUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SIGNED_USERS_SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: any): SignedUser | null => {
        const id = String(entry?.id || "").trim();
        if (!id) return null;
        return {
          id,
          name: String(entry?.name || "User"),
          phone: String(entry?.phone || ""),
          createdAt: String(entry?.createdAt || ""),
          isBlocked: Boolean(entry?.isBlocked),
          hasLoyalty: Boolean(entry?.hasLoyalty),
        };
      })
      .filter((entry): entry is SignedUser => entry !== null);
  } catch {
    return [];
  }
}

function writeSignedUsersSnapshot(users: SignedUser[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIGNED_USERS_SNAPSHOT_KEY, JSON.stringify(users));
  } catch {
    // Ignore snapshot persistence failures.
  }
}

export async function loadAdminPanelData(): Promise<AdminLoadResult> {
  const [popularResponse, currencyResponse, whitelistResponse, adminsResponse, tutorialResponse, pushResponse] = await Promise.all([
    getAdminPopularDestinations(),
    getCurrencySettings(),
    getWhitelistSettings(),
    getSuperAdmins(),
    getHomeTutorialSettings(),
    getPushNotificationSummary(),
  ]);

  return {
    popularCodes: popularResponse.success && Array.isArray(popularResponse.data) ? popularResponse.data : [],
    currency: {
      enableIQD: Boolean(currencyResponse.data?.enableIQD),
      exchangeRate: String(currencyResponse.data?.exchangeRate || "1320"),
      markupPercent: String(currencyResponse.data?.markupPercent || "0"),
    },
    whitelist: {
      enabled: Boolean(whitelistResponse.data?.enabled),
      codes: Array.isArray(whitelistResponse.data?.codes) ? whitelistResponse.data.codes : [],
    },
    admins:
      adminsResponse.success && Array.isArray(adminsResponse.data)
        ? adminsResponse.data.map((entry: any) => String(entry?.phone || "").trim()).filter(Boolean)
        : [],
    tutorial: {
      enabled: Boolean(tutorialResponse.enabled),
      cardTitle: String(tutorialResponse.cardTitle || ""),
      cardSubtitle: String(tutorialResponse.cardSubtitle || ""),
      modalTitle: String(tutorialResponse.modalTitle || ""),
      iphoneVideoUrl: String(tutorialResponse.iphone?.videoUrl || ""),
      iphoneThumbnailUrl: String(tutorialResponse.iphone?.thumbnailUrl || ""),
      iphoneDescription: String(tutorialResponse.iphone?.description || ""),
      iphoneDurationLabel: String(tutorialResponse.iphone?.durationLabel || ""),
      androidVideoUrl: String(tutorialResponse.android?.videoUrl || ""),
      androidThumbnailUrl: String(tutorialResponse.android?.thumbnailUrl || ""),
      androidDescription: String(tutorialResponse.android?.description || ""),
      androidDurationLabel: String(tutorialResponse.android?.durationLabel || ""),
    },
    push: {
      available: Boolean(pushResponse.success),
      error: String(pushResponse.error || ""),
      providerConfigured: Boolean(pushResponse.data?.providerConfigured),
      totalDevices: Number(pushResponse.data?.totalDevices || 0),
      enabledDevices: Number(pushResponse.data?.enabledDevices || 0),
      authenticatedDevices: Number(pushResponse.data?.authenticatedDevices || 0),
      loyaltyDevices: Number(pushResponse.data?.loyaltyDevices || 0),
      activeEsimDevices: Number(pushResponse.data?.activeEsimDevices || 0),
      iosDevices: Number(pushResponse.data?.iosDevices || 0),
      androidDevices: Number(pushResponse.data?.androidDevices || 0),
      lastTitle: String(pushResponse.data?.lastCampaign?.title || ""),
      lastSentAt: String(pushResponse.data?.lastCampaign?.createdAt || ""),
    },
  };
}

export async function loadPopularCodes(): Promise<string[]> {
  const response = await getAdminPopularDestinations();
  return response.success && Array.isArray(response.data) ? response.data : [];
}

export async function loadCurrencyConfig(): Promise<AdminLoadResult["currency"]> {
  const response = await getCurrencySettings();
  return {
    enableIQD: Boolean(response.data?.enableIQD),
    exchangeRate: String(response.data?.exchangeRate || "1320"),
    markupPercent: String(response.data?.markupPercent || "0"),
  };
}

export async function loadWhitelistConfig(): Promise<AdminLoadResult["whitelist"]> {
  const response = await getWhitelistSettings();
  return {
    enabled: Boolean(response.data?.enabled),
    codes: Array.isArray(response.data?.codes) ? response.data.codes : [],
  };
}

export async function loadAdminPhones(): Promise<string[]> {
  const response = await getSuperAdmins();
  if (!response.success || !Array.isArray(response.data)) {
    return [];
  }
  return response.data.map((entry: any) => String(entry?.phone || "").trim()).filter(Boolean);
}

export async function loadPushNotificationSummary(): Promise<PushNotificationSummary> {
  const response = await getPushNotificationSummary();
  const rawError = String(response.error || "").trim();
  const normalizedError = /failed to fetch/i.test(rawError)
    ? "Network request to push admin summary failed."
    : rawError;
  return {
    available: Boolean(response.success),
    error: normalizedError,
    providerConfigured: Boolean(response.data?.providerConfigured),
    totalDevices: Number(response.data?.totalDevices || 0),
    enabledDevices: Number(response.data?.enabledDevices || 0),
    authenticatedDevices: Number(response.data?.authenticatedDevices || 0),
    loyaltyDevices: Number(response.data?.loyaltyDevices || 0),
    activeEsimDevices: Number(response.data?.activeEsimDevices || 0),
    iosDevices: Number(response.data?.iosDevices || 0),
    androidDevices: Number(response.data?.androidDevices || 0),
    lastTitle: String(response.data?.lastCampaign?.title || ""),
    lastSentAt: String(response.data?.lastCampaign?.createdAt || ""),
  };
}

export async function sendAdminPushNotification(payload: {
  title: string;
  body: string;
  route?: string;
  audience?: PushNotificationAudience;
  kind: PushNotificationKind;
  userIds?: string[];
}) {
  return sendPushNotification({ ...payload, userIds: payload.userIds });
}

export async function sendAdminAppUpdatePushNotification(payload: {
  title: string;
  body: string;
  appStoreUrl: string;
  playStoreUrl: string;
  audience?: PushNotificationAudience;
  dryRun?: boolean;
}) {
  return sendAppUpdatePush({
    title: String(payload.title || "").trim(),
    body: String(payload.body || "").trim(),
    appStoreUrl: String(payload.appStoreUrl || "").trim(),
    playStoreUrl: String(payload.playStoreUrl || "").trim(),
    audience: String(payload.audience || "all").trim() || "all",
    dryRun: Boolean(payload.dryRun),
  });
}

export async function loadHomeTutorialConfig(): Promise<AdminLoadResult["tutorial"]> {
  const response = await getHomeTutorialSettings();
  return {
    enabled: Boolean(response.enabled),
    cardTitle: String(response.cardTitle || ""),
    cardSubtitle: String(response.cardSubtitle || ""),
    modalTitle: String(response.modalTitle || ""),
    iphoneVideoUrl: String(response.iphone?.videoUrl || ""),
    iphoneThumbnailUrl: String(response.iphone?.thumbnailUrl || ""),
    iphoneDescription: String(response.iphone?.description || ""),
    iphoneDurationLabel: String(response.iphone?.durationLabel || ""),
    androidVideoUrl: String(response.android?.videoUrl || ""),
    androidThumbnailUrl: String(response.android?.thumbnailUrl || ""),
    androidDescription: String(response.android?.description || ""),
    androidDurationLabel: String(response.android?.durationLabel || ""),
  };
}

function invalidatePopularCaches(): void {
  try {
    localStorage.removeItem("home.popular.content.v1");
    localStorage.removeItem("home.popular.codes.v1");
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("tulip:popular-updated"));
}

export async function savePopularDestinations(codes: string[]) {
  const result = await setAdminPopularDestinations(codes);
  if (result.success) invalidatePopularCaches();
  return result;
}

export async function clearPopularDestinations() {
  const result = await clearAdminPopularDestinations();
  if (result.success) invalidatePopularCaches();
  return result;
}

export async function saveCurrencyConfig(payload: {
  enableIQD: boolean;
  exchangeRate: string;
  markupPercent: string;
}) {
  return updateCurrencySettings(payload);
}

export async function saveWhitelistConfig(payload: { enabled: boolean; codes: string[] }) {
  return updateWhitelistSettings(payload);
}

export async function addAdminPhone(phone: string) {
  return addSuperAdmin(String(phone || "").trim(), "Admin User");
}

export async function removeAdminPhone(phone: string) {
  return removeSuperAdmin(String(phone || "").trim());
}

export async function saveHomeTutorialConfig(payload: AdminLoadResult["tutorial"]) {
  return updateHomeTutorialSettings({
    enabled: Boolean(payload.enabled),
    cardTitle: String(payload.cardTitle || ""),
    cardSubtitle: String(payload.cardSubtitle || ""),
    modalTitle: String(payload.modalTitle || ""),
    iphone: {
      videoUrl: String(payload.iphoneVideoUrl || ""),
      thumbnailUrl: String(payload.iphoneThumbnailUrl || ""),
      description: String(payload.iphoneDescription || ""),
      durationLabel: String(payload.iphoneDurationLabel || ""),
    },
    android: {
      videoUrl: String(payload.androidVideoUrl || ""),
      thumbnailUrl: String(payload.androidThumbnailUrl || ""),
      description: String(payload.androidDescription || ""),
      durationLabel: String(payload.androidDurationLabel || ""),
    },
  });
}

export async function loadSignedUpUsers(): Promise<LoadedSignedUser[]> {
  const response = await getUsers();
  if (!response.success) {
    throw new Error(response.error || "Failed to load signed users");
  }

  if (!Array.isArray(response.data)) {
    throw new Error("Signed users response was not a list");
  }

  return response.data
    .map((entry: any, index: number) => {
      // Prefer raw backend payload when available. getUsers() emits normalized booleans that may
      // default to false, which can incorrectly override known state during subsequent reloads.
      const raw = entry?.raw && typeof entry.raw === "object" ? entry.raw : entry;

      const status = String(
        raw?.status ||
          raw?.userStatus ||
          raw?.user_status ||
          raw?.accountStatus ||
          raw?.account_status ||
          "",
      ).trim().toLowerCase();
      const isDeleted = status === "deleted" || status === "soft_deleted" || status === "soft-deleted";
      if (isDeleted) {
        return null;
      }

      const blockedValue =
        parseOptionalBoolean(raw?.isBlocked) ??
        parseOptionalBoolean(raw?.blocked) ??
        parseOptionalBoolean(raw?.is_disabled) ??
        parseOptionalBoolean(raw?.disabled) ??
        (raw?.isActive === false ? true : undefined) ??
        (raw?.active === false ? true : undefined) ??
        parseOptionalBoolean(raw?.is_blocked) ??
        parseOptionalBoolean(raw?.status === "blocked" ? true : undefined);

      const loyaltyValue =
        parseOptionalBoolean(raw?.hasLoyalty) ??
        parseOptionalBoolean(raw?.loyaltyEnabled) ??
        parseOptionalBoolean(raw?.loyaltyGranted) ??
        parseOptionalBoolean(raw?.loyalty) ??
        parseOptionalBoolean(raw?.isLoyalty) ??
        parseOptionalBoolean(raw?.is_loyalty) ??
        parseOptionalBoolean(raw?.loyalty_enabled) ??
        parseOptionalBoolean(raw?.is_loyalty_user) ??
        parseOptionalBoolean(raw?.isLoyaltyUser) ??
        parseOptionalBoolean(raw?.customFields?.loyaltyEnabled) ??
        parseOptionalBoolean(raw?.custom_fields?.loyalty_enabled);

      return {
        id: String(entry?.id || `user-${index + 1}`),
        name: String(entry?.name || "User"),
        phone: String(entry?.phone || ""),
        createdAt: String(entry?.createdAt || entry?.created_at || entry?.registeredAt || ""),
        isBlocked: blockedValue ?? false,
        hasLoyalty: loyaltyValue ?? false,
        blockedKnown: blockedValue !== undefined,
        loyaltyKnown: loyaltyValue !== undefined,
      };
    })
    .filter((entry): entry is LoadedSignedUser => Boolean(entry && (entry.id || entry.phone || entry.name)));
}

export async function deleteSignedUser(userId: string) {
  return deleteUserAccount(String(userId || "").trim());
}

export async function blockSignedUser(userId: string, blocked = true) {
  return blockUserAccount(String(userId || "").trim(), blocked);
}

export async function grantSignedUserLoyalty(userId: string, granted = true) {
  return grantUserLoyalty(String(userId || "").trim(), granted);
}

export async function editSignedUser(userId: string, payload: { name: string; phone: string }) {
  return editUserAccount(String(userId || "").trim(), payload);
}

const DEFAULT_APP_UPDATE_TITLE = "Update Available";
const DEFAULT_APP_UPDATE_BODY = "A new version is available. Please update now.";
const DEFAULT_APP_STORE_URL = "https://apps.apple.com/app/tulip-booking/id6759516330";
const DEFAULT_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.theesim.app";

export function useAdminPageModel(): AdminPageModel {
  const [countryCodes, setCountryCodes] = useState("");
  const [currentDestinations, setCurrentDestinations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [enableIQD, setEnableIQD] = useState(false);
  const [exchangeRate, setExchangeRate] = useState("1320");
  const [markupPercent, setMarkupPercent] = useState("0");
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistCodes, setWhitelistCodes] = useState("");
  const [currentWhitelist, setCurrentWhitelist] = useState<string[]>([]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [newAdminPhone, setNewAdminPhone] = useState("");
  const [currentAdmins, setCurrentAdmins] = useState<string[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [tutorialEnabled, setTutorialEnabled] = useState(false);
  const [tutorialCardTitle, setTutorialCardTitle] = useState("");
  const [tutorialCardSubtitle, setTutorialCardSubtitle] = useState("");
  const [tutorialModalTitle, setTutorialModalTitle] = useState("");
  const [tutorialIphoneVideoUrl, setTutorialIphoneVideoUrl] = useState("");
  const [tutorialIphoneThumbnailUrl, setTutorialIphoneThumbnailUrl] = useState("");
  const [tutorialIphoneDescription, setTutorialIphoneDescription] = useState("");
  const [tutorialIphoneDurationLabel, setTutorialIphoneDurationLabel] = useState("");
  const [tutorialAndroidVideoUrl, setTutorialAndroidVideoUrl] = useState("");
  const [tutorialAndroidThumbnailUrl, setTutorialAndroidThumbnailUrl] = useState("");
  const [tutorialAndroidDescription, setTutorialAndroidDescription] = useState("");
  const [tutorialAndroidDurationLabel, setTutorialAndroidDurationLabel] = useState("");
  const [tutorialLoading, setTutorialLoading] = useState(false);
  const [tutorialUploadLoadingPlatform, setTutorialUploadLoadingPlatform] = useState<
    "" | "iphone-video" | "android-video" | "iphone-thumbnail" | "android-thumbnail"
  >("");
  const [pushSummary, setPushSummary] = useState<PushNotificationSummary>({
    available: true,
    error: "",
    providerConfigured: false,
    totalDevices: 0,
    enabledDevices: 0,
    authenticatedDevices: 0,
    loyaltyDevices: 0,
    activeEsimDevices: 0,
    iosDevices: 0,
    androidDevices: 0,
    lastTitle: "",
    lastSentAt: "",
  });
  const [pushSummaryLoading, setPushSummaryLoading] = useState(false);
  const [pushSending, setPushSending] = useState(false);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushRoute, setPushRoute] = useState("/");
  const [pushAudience, setPushAudience] = useState<PushNotificationAudience>("all");
  const [pushKind, setPushKind] = useState<PushNotificationKind>("offers");
  const [pushTargetMode, setPushTargetMode] = useState<"audience" | "users">("audience");
  const [pushTargetUserSearch, setPushTargetUserSearch] = useState("");
  const [pushTargetUserIds, setPushTargetUserIds] = useState<string[]>([]);
  const [pushTargetUserOptions, setPushTargetUserOptions] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [appUpdateSending, setAppUpdateSending] = useState(false);
  const [appUpdateTitle, setAppUpdateTitle] = useState(DEFAULT_APP_UPDATE_TITLE);
  const [appUpdateBody, setAppUpdateBody] = useState(DEFAULT_APP_UPDATE_BODY);
  const [appUpdateAppStoreUrl, setAppUpdateAppStoreUrl] = useState(DEFAULT_APP_STORE_URL);
  const [appUpdatePlayStoreUrl, setAppUpdatePlayStoreUrl] = useState(DEFAULT_PLAY_STORE_URL);
  const [appUpdateLastResult, setAppUpdateLastResult] = useState<AppUpdatePushResultSummary | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userActionLoadingId, setUserActionLoadingId] = useState("");
  const [signedUsers, setSignedUsers] = useState<SignedUser[]>(() => readSignedUsersSnapshot());
  const [showSignedUsers, setShowSignedUsers] = useState(false);
  const [openActionMenuUserId, setOpenActionMenuUserId] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<SignedUser | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editUserName, setEditUserName] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");

  useEffect(() => {
    const loadInitialAdminData = async () => {
      setLoadingCurrent(true);
      setCurrencyLoading(true);
      setWhitelistLoading(true);
      setAdminLoading(true);
      setTutorialLoading(true);
      setPushSummaryLoading(true);
      try {
        const data = await loadAdminPanelData();
        setCurrentDestinations(data.popularCodes);
        setEnableIQD(data.currency.enableIQD);
        setExchangeRate(data.currency.exchangeRate);
        setMarkupPercent(data.currency.markupPercent);
        setWhitelistEnabled(data.whitelist.enabled);
        setWhitelistCodes((data.whitelist.codes || []).join(", "));
        setCurrentWhitelist(data.whitelist.codes || []);
        setCurrentAdmins(data.admins || []);
        setTutorialEnabled(data.tutorial.enabled);
        setTutorialCardTitle(data.tutorial.cardTitle);
        setTutorialCardSubtitle(data.tutorial.cardSubtitle);
        setTutorialModalTitle(data.tutorial.modalTitle);
        setTutorialIphoneVideoUrl(data.tutorial.iphoneVideoUrl);
        setTutorialIphoneThumbnailUrl(data.tutorial.iphoneThumbnailUrl);
        setTutorialIphoneDescription(data.tutorial.iphoneDescription);
        setTutorialIphoneDurationLabel(data.tutorial.iphoneDurationLabel);
        setTutorialAndroidVideoUrl(data.tutorial.androidVideoUrl);
        setTutorialAndroidThumbnailUrl(data.tutorial.androidThumbnailUrl);
        setTutorialAndroidDescription(data.tutorial.androidDescription);
        setTutorialAndroidDurationLabel(data.tutorial.androidDurationLabel);
        setPushSummary(data.push);
      } finally {
        setLoadingCurrent(false);
        setCurrencyLoading(false);
        setWhitelistLoading(false);
        setAdminLoading(false);
        setTutorialLoading(false);
        setPushSummaryLoading(false);
      }
    };

    void loadInitialAdminData();
  }, []);

  useEffect(() => {
    if (pushTargetMode !== "users") return;
    if (pushTargetUserOptions.length > 0) return;
    // Load users for targeting when switching to user mode
    void (async () => {
      try {
        const users = await loadSignedUpUsers();
        setPushTargetUserOptions(users.map((u) => ({ id: u.id, name: u.name, phone: u.phone })));
      } catch { /* ignore */ }
    })();
  }, [pushTargetMode, pushTargetUserOptions.length]);

  const loadCurrentDestinations = async () => {
    setLoadingCurrent(true);
    const destinations = await loadPopularCodes();
    setCurrentDestinations(destinations);
    setLoadingCurrent(false);
  };

  const loadWhitelistSettings = async () => {
    setWhitelistLoading(true);
    const whitelist = await loadWhitelistConfig();
    setWhitelistEnabled(whitelist.enabled);
    setWhitelistCodes((whitelist.codes || []).join(", "));
    setCurrentWhitelist(whitelist.codes || []);
    setWhitelistLoading(false);
  };

  const loadSuperAdmins = async () => {
    setAdminLoading(true);
    const admins = await loadAdminPhones();
    setCurrentAdmins(admins);
    setAdminLoading(false);
  };

  const refreshPushSummary = async () => {
    setPushSummaryLoading(true);
    try {
      const summary = await loadPushNotificationSummary();
      setPushSummary(summary);
    } finally {
      setPushSummaryLoading(false);
    }
  };

  return {
    countryCodes,
    currentDestinations,
    loading,
    loadingCurrent,
    enableIQD,
    exchangeRate,
    markupPercent,
    currencyLoading,
    whitelistEnabled,
    whitelistCodes,
    currentWhitelist,
    whitelistLoading,
    newAdminPhone,
    currentAdmins,
    adminLoading,
    tutorialEnabled,
    tutorialCardTitle,
    tutorialCardSubtitle,
    tutorialModalTitle,
    tutorialIphoneVideoUrl,
    tutorialIphoneThumbnailUrl,
    tutorialIphoneDescription,
    tutorialIphoneDurationLabel,
    tutorialAndroidVideoUrl,
    tutorialAndroidThumbnailUrl,
    tutorialAndroidDescription,
    tutorialAndroidDurationLabel,
    tutorialLoading,
    tutorialUploadLoadingPlatform,
    pushSummary,
    pushSummaryLoading,
    pushSending,
    pushTitle,
    pushBody,
    pushRoute,
    pushAudience,
    pushKind,
    appUpdateSending,
    appUpdateTitle,
    appUpdateBody,
    appUpdateAppStoreUrl,
    appUpdatePlayStoreUrl,
    appUpdateLastResult,
    usersLoading,
    userActionLoadingId,
    signedUsers,
    showSignedUsers,
    openActionMenuUserId,
    deleteDialogOpen,
    deleteTargetUser,
    editDialogOpen,
    editUserId,
    editUserName,
    editUserPhone,
    setCountryCodes,
    setEnableIQD,
    setExchangeRate,
    setMarkupPercent,
    setWhitelistEnabled,
    setWhitelistCodes,
    setNewAdminPhone,
    setTutorialEnabled,
    setTutorialCardTitle,
    setTutorialCardSubtitle,
    setTutorialModalTitle,
    setTutorialIphoneVideoUrl,
    setTutorialIphoneThumbnailUrl,
    setTutorialIphoneDescription,
    setTutorialIphoneDurationLabel,
    setTutorialAndroidVideoUrl,
    setTutorialAndroidThumbnailUrl,
    setTutorialAndroidDescription,
    setTutorialAndroidDurationLabel,
    setPushTitle,
    setPushBody,
    setPushRoute,
    setPushAudience,
    setPushKind,
    pushTargetMode,
    pushTargetUserSearch,
    pushTargetUserIds,
    pushTargetUserOptions,
    setPushTargetMode,
    setPushTargetUserSearch,
    togglePushTargetUser: (userId: string) => {
      setPushTargetUserIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
      );
    },
    setAppUpdateTitle,
    setAppUpdateBody,
    setAppUpdateAppStoreUrl,
    setAppUpdatePlayStoreUrl,
    setOpenActionMenuUserId,
    setDeleteDialogOpen,
    setDeleteTargetUser,
    setEditDialogOpen,
    setEditUserName,
    setEditUserPhone,
    handleSave: async () => {
      setLoading(true);
      try {
        const codes = parseIsoCodeList(countryCodes);
        if (codes.length === 0) {
          toast.error("Please enter at least one valid country code");
          return;
        }

        const response = await savePopularDestinations(codes);
        if (response.success) {
          toast.success(`Popular destinations updated: ${codes.join(", ")}`);
          setCountryCodes("");
          await loadCurrentDestinations();
        } else {
          toast.error(response.error || "Failed to update popular destinations");
        }
      } catch (error) {
        console.error("Error updating popular destinations:", error);
        toast.error(`Failed to update: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    },
    handleClear: async () => {
      setLoading(true);
      const response = await clearPopularDestinations();
      if (response.success) {
        toast.success("Popular destinations cleared");
        setCountryCodes("");
        await loadCurrentDestinations();
      } else {
        toast.error(response.error || "Failed to clear popular destinations");
      }
      setLoading(false);
    },
    handleSaveCurrencySettings: async () => {
      setCurrencyLoading(true);
      const response = await saveCurrencyConfig({
        enableIQD,
        exchangeRate,
        markupPercent,
      });

      if (response.success) {
        toast.success("Currency settings updated");
      } else {
        toast.error(response.error || "Failed to update currency settings");
      }
      setCurrencyLoading(false);
    },
    handleSaveWhitelistSettings: async () => {
      setWhitelistLoading(true);
      try {
        const codes = parseIsoCodeList(whitelistCodes);
        if (whitelistEnabled && codes.length === 0) {
          toast.error("Please enter at least one valid country code");
          return;
        }

        const response = await saveWhitelistConfig({
          enabled: whitelistEnabled,
          codes: whitelistEnabled ? codes : [],
        });

        if (response.success) {
          toast.success("Whitelist settings updated");
          setWhitelistCodes("");
          await loadWhitelistSettings();
        } else {
          toast.error(response.error || "Failed to update whitelist settings");
        }
      } catch (error) {
        console.error("Error updating whitelist settings:", error);
        toast.error(`Failed to update: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setWhitelistLoading(false);
      }
    },
    handleClearWhitelistSettings: async () => {
      setWhitelistLoading(true);
      const response = await saveWhitelistConfig({
        enabled: false,
        codes: [],
      });

      if (response.success) {
        toast.success("Whitelist settings cleared");
        setWhitelistCodes("");
        await loadWhitelistSettings();
      } else {
        toast.error(response.error || "Failed to clear whitelist settings");
      }
      setWhitelistLoading(false);
    },
    handleAddSuperAdmin: async () => {
      setAdminLoading(true);
      const response = await addAdminPhone(newAdminPhone);
      if (response.success) {
        toast.success("Super admin added");
        setNewAdminPhone("");
        await loadSuperAdmins();
      } else {
        toast.error(response.error || "Failed to add super admin");
      }
      setAdminLoading(false);
    },
    handleRemoveSuperAdmin: async (phone: string) => {
      setAdminLoading(true);
      const response = await removeAdminPhone(phone);
      if (response.success) {
        toast.success("Super admin removed");
        await loadSuperAdmins();
      } else {
        toast.error(response.error || "Failed to remove super admin");
      }
      setAdminLoading(false);
    },
    handleSaveTutorialSettings: async () => {
      setTutorialLoading(true);
      try {
        const response = await saveHomeTutorialConfig({
          enabled: tutorialEnabled,
          cardTitle: tutorialCardTitle,
          cardSubtitle: tutorialCardSubtitle,
          modalTitle: tutorialModalTitle,
          iphoneVideoUrl: tutorialIphoneVideoUrl,
          iphoneThumbnailUrl: tutorialIphoneThumbnailUrl,
          iphoneDescription: tutorialIphoneDescription,
          iphoneDurationLabel: tutorialIphoneDurationLabel,
          androidVideoUrl: tutorialAndroidVideoUrl,
          androidThumbnailUrl: tutorialAndroidThumbnailUrl,
          androidDescription: tutorialAndroidDescription,
          androidDurationLabel: tutorialAndroidDurationLabel,
        });

        setTutorialEnabled(response.enabled);
        setTutorialCardTitle(response.cardTitle);
        setTutorialCardSubtitle(response.cardSubtitle);
        setTutorialModalTitle(response.modalTitle);
        setTutorialIphoneVideoUrl(response.iphone.videoUrl);
        setTutorialIphoneThumbnailUrl(response.iphone.thumbnailUrl);
        setTutorialIphoneDescription(response.iphone.description);
        setTutorialIphoneDurationLabel(response.iphone.durationLabel);
        setTutorialAndroidVideoUrl(response.android.videoUrl);
        setTutorialAndroidThumbnailUrl(response.android.thumbnailUrl);
        setTutorialAndroidDescription(response.android.description);
        setTutorialAndroidDurationLabel(response.android.durationLabel);
        toast.success("Home tutorial settings updated");
      } catch (error) {
        console.error("Error updating home tutorial settings:", error);
        toast.error(`Failed to update: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setTutorialLoading(false);
      }
    },
    handleUploadTutorialVideo: async (platform, file) => {
      if (!file) {
        return;
      }

      const loadingKey = platform === "iphone" ? "iphone-video" : "android-video";
      setTutorialUploadLoadingPlatform(loadingKey);

      try {
        const uploaded = await uploadHomeTutorialAsset({
          platform,
          assetType: "video",
          file,
        });

        if (platform === "iphone") {
          setTutorialIphoneVideoUrl(uploaded.url);
        } else {
          setTutorialAndroidVideoUrl(uploaded.url);
        }

        toast.success(`${platform === "iphone" ? "iPhone" : "Android"} video uploaded`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to upload video");
      } finally {
        setTutorialUploadLoadingPlatform("");
      }
    },
    handleUploadTutorialThumbnail: async (platform, file) => {
      if (!file) {
        return;
      }

      const loadingKey = platform === "iphone" ? "iphone-thumbnail" : "android-thumbnail";
      setTutorialUploadLoadingPlatform(loadingKey);

      try {
        const uploaded = await uploadHomeTutorialAsset({
          platform,
          assetType: "thumbnail",
          file,
        });

        if (platform === "iphone") {
          setTutorialIphoneThumbnailUrl(uploaded.url);
        } else {
          setTutorialAndroidThumbnailUrl(uploaded.url);
        }

        toast.success(`${platform === "iphone" ? "iPhone" : "Android"} thumbnail uploaded`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to upload thumbnail");
      } finally {
        setTutorialUploadLoadingPlatform("");
      }
    },
    handleSendPushNotification: async () => {
      const title = pushTitle.trim();
      const body = pushBody.trim();
      const route = pushRoute.trim();

      if (!title || !body) {
        toast.error("Please enter both a title and body for the notification");
        return;
      }

      if (pushTargetMode === "users" && pushTargetUserIds.length === 0) {
        toast.error("Please select at least one user.");
        return;
      }

      if (pushTargetMode === "audience" && !String(pushAudience || "").trim()) {
        toast.error("Please select an audience.");
        return;
      }

      setPushSending(true);
      try {
        const response = await sendAdminPushNotification({
          title,
          body,
          route,
          audience: pushTargetMode === "users" ? undefined : pushAudience,
          kind: pushKind,
          ...(pushTargetMode === "users" ? { userIds: pushTargetUserIds } : {}),
        });

        if (!response.success) {
          toast.error(response.error || "Failed to send push notification");
          return;
        }

        const requestedTokens = Number(response.data?.delivery?.requestedTokens ?? response.data?.requestedTokens ?? 0);
        const successCount = Number(response.data?.delivery?.successCount ?? response.data?.successCount ?? 0);
        const failureCount = Number(response.data?.delivery?.failureCount ?? response.data?.failureCount ?? 0);
        const rawInvalidTokens = response.data?.delivery?.invalidTokens ?? response.data?.invalidTokens;
        const invalidTokensArray = Array.isArray(rawInvalidTokens) ? rawInvalidTokens.filter(t => typeof t === "string" && t) : [];
        const invalidTokenCount = Number(
          response.data?.delivery?.invalidTokenCount ??
            response.data?.invalidTokenCount ??
            invalidTokensArray.length,
        );

        if (invalidTokensArray.length > 0) {
          try {
            console.info(`[admin-push-send] Starting background cleanup of ${invalidTokensArray.length} invalid tokens...`);
            Promise.allSettled(
              invalidTokensArray.map(token => 
                unregisterPushDevice({ installId: "admin-cleanup", token })
              )
            ).catch(() => {});
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        try {
          const isDevMode = Boolean((import.meta as any)?.env?.DEV);
          if (isDevMode && response.data?.debug) {
            console.info("[admin-push-send] backend-debug", response.data.debug);
          }
        } catch {
          // No-op logging guard.
        }

        toast.success(
          requestedTokens > 0
            ? `Push sent: ${successCount}/${requestedTokens} delivered`
            : "Push request completed",
          failureCount > 0 || invalidTokenCount > 0
            ? {
                description: `${failureCount} failed, ${invalidTokenCount} invalid token${invalidTokenCount === 1 ? "" : "s"}.`,
              }
            : undefined,
        );
        setPushTitle("");
        setPushBody("");
        setPushRoute("/");
        await refreshPushSummary();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send push notification");
      } finally {
        setPushSending(false);
      }
    },
    handleSendAppUpdatePushNotification: async () => {
      const title = appUpdateTitle.trim();
      const body = appUpdateBody.trim();
      const appStoreUrl = appUpdateAppStoreUrl.trim();
      const playStoreUrl = appUpdatePlayStoreUrl.trim();

      if (!title || !body) {
        toast.error("Please enter both update title and message.");
        return;
      }

      if (!/^https:\/\//i.test(appStoreUrl) || !/^https:\/\//i.test(playStoreUrl)) {
        toast.error("App Store and Play Store links must start with https://");
        return;
      }

      setAppUpdateSending(true);
      try {
        const response = await sendAdminAppUpdatePushNotification({
          title,
          body,
          appStoreUrl,
          playStoreUrl,
          audience: "all",
          dryRun: false,
        });

        if (!response.success) {
          toast.error(response.error || "Failed to send app update push");
          return;
        }

        const requestedTokens = Number(response.data?.requestedTokens || 0);
        const successCount = Number(response.data?.successCount || 0);
        const failureCount = Number(response.data?.failureCount || 0);
        const rawInvalidTokens = response.data?.delivery?.invalidTokens ?? response.data?.invalidTokens;
        const invalidTokensArray = Array.isArray(rawInvalidTokens) ? rawInvalidTokens.filter(t => typeof t === "string" && t) : [];

        if (invalidTokensArray.length > 0) {
          try {
            console.info(`[admin-push-send] Starting background cleanup of ${invalidTokensArray.length} invalid tokens for app update push...`);
            Promise.allSettled(
              invalidTokensArray.map(token => 
                unregisterPushDevice({ installId: "admin-cleanup", token })
              )
            ).catch(() => {});
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        setAppUpdateLastResult({
          requestedTokens,
          successCount,
          failureCount,
          sentAt: new Date().toISOString(),
        });

        toast.success(
          requestedTokens > 0
            ? `App update push sent: ${successCount}/${requestedTokens} delivered`
            : "App update push request completed",
          failureCount > 0
            ? { description: `${failureCount} delivery attempt${failureCount === 1 ? "" : "s"} failed.` }
            : undefined,
        );

        await refreshPushSummary();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send app update push");
      } finally {
        setAppUpdateSending(false);
      }
    },
    handleToggleSignedUsers: async () => {
      if (showSignedUsers) {
        setShowSignedUsers(false);
        return;
      }

      setUsersLoading(true);
      try {
        const freshUsers = await loadSignedUpUsers();
        // Merge with existing state to preserve known flags until backend confirms a change
        setSignedUsers((prev) => {
          const prevById = new Map(prev.map((u) => [u.id, u]));
          const merged = freshUsers.map((fresh) => {
            const existing = prevById.get(fresh.id);
            if (!existing) {
              return {
                id: fresh.id,
                name: fresh.name,
                phone: fresh.phone,
                createdAt: fresh.createdAt,
                isBlocked: fresh.isBlocked,
                hasLoyalty: fresh.hasLoyalty,
              };
            }
            return {
              id: fresh.id,
              name: fresh.name,
              phone: fresh.phone,
              createdAt: fresh.createdAt,
              isBlocked: fresh.blockedKnown ? fresh.isBlocked : existing.isBlocked,
              hasLoyalty: fresh.loyaltyKnown ? fresh.hasLoyalty : existing.hasLoyalty,
            };
          });
          writeSignedUsersSnapshot(merged);
          return merged;
        });
        setShowSignedUsers(true);
        const users = freshUsers;
        toast.success(`Loaded ${users.length} signed user${users.length === 1 ? "" : "s"}`);
      } catch (error) {
        toast.error("Failed to load signed users", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setUsersLoading(false);
      }
    },
    handleDeleteSignedUser: (user: SignedUser) => {
      setDeleteTargetUser(user);
      setDeleteDialogOpen(true);
    },
    handleConfirmDeleteSignedUser: async () => {
      const user = deleteTargetUser;
      if (!user) {
        return;
      }

      setDeleteDialogOpen(false);
      setUserActionLoadingId(user.id);
      const response = await deleteSignedUser(user.id);
      setUserActionLoadingId("");
      setDeleteTargetUser(null);

      if (!response.success) {
        const statusCode = parseHttpStatusCodeFromError(response.error);

        if (statusCode === 401 || statusCode === 403) {
          toast.error("Not authorized");
          return;
        }

        if (statusCode === 404) {
          toast.error("User not found (already deleted)");
          if (showSignedUsers) {
            setUsersLoading(true);
            try {
              const refreshedUsers = await loadSignedUpUsers();
              const next = refreshedUsers.map((entry) => ({
                id: entry.id,
                name: entry.name,
                phone: entry.phone,
                createdAt: entry.createdAt,
                isBlocked: entry.isBlocked,
                hasLoyalty: entry.hasLoyalty,
              }));
              setSignedUsers(next);
              writeSignedUsersSnapshot(next);
            } catch (refreshError) {
              toast.error("Failed to refresh users after delete", {
                description: refreshError instanceof Error ? refreshError.message : "Unknown error",
              });
            } finally {
              setUsersLoading(false);
            }
          }
          return;
        }

        toast.error(response.error || "Failed to delete user");
        return;
      }

      setSignedUsers((prev) => {
        const next = prev.filter((entry) => entry.id !== user.id);
        writeSignedUsersSnapshot(next);
        return next;
      });
      toast.success("User deleted");
    },
    handleBlockSignedUser: async (user: SignedUser) => {
      setUserActionLoadingId(user.id);
      const nextBlocked = !user.isBlocked;
      const response = await blockSignedUser(user.id, nextBlocked);
      setUserActionLoadingId("");

      if (!response.success) {
        toast.error(response.error || "Failed to block user");
        return;
      }

      setSignedUsers((prev) =>
        {
          const next = prev.map((entry) => (entry.id === user.id ? { ...entry, isBlocked: nextBlocked } : entry));
          writeSignedUsersSnapshot(next);
          return next;
        },
      );
      toast.success(nextBlocked ? "User blocked" : "User unblocked");
    },
    handleGrantLoyalty: async (user: SignedUser) => {
      setUserActionLoadingId(user.id);
      const nextGranted = !user.hasLoyalty;
      const response = await grantSignedUserLoyalty(user.id, nextGranted);
      setUserActionLoadingId("");

      if (!response.success) {
        toast.error(response.error || "Failed to update loyalty");
        return;
      }

      setSignedUsers((prev) =>
        {
          const next = prev.map((entry) => (entry.id === user.id ? { ...entry, hasLoyalty: nextGranted } : entry));
          writeSignedUsersSnapshot(next);
          return next;
        },
      );
      toast.success(nextGranted ? "Loyalty granted" : "Loyalty disabled");
    },
    handleOpenEditUser: (user: SignedUser) => {
      setEditUserId(user.id);
      setEditUserName(user.name || "");
      setEditUserPhone(user.phone || "");
      setEditDialogOpen(true);
    },
    handleSaveEditedUser: async () => {
      const nextName = editUserName.trim();
      const nextPhone = editUserPhone.trim();

      if (!editUserId) {
        return;
      }
      if (!nextName && !nextPhone) {
        toast.error("Please enter at least a name or phone number");
        return;
      }

      setUserActionLoadingId(editUserId);
      const response = await editSignedUser(editUserId, { name: nextName, phone: nextPhone });
      setUserActionLoadingId("");

      if (!response.success) {
        toast.error(response.error || "Failed to edit user");
        return;
      }

      setSignedUsers((prev) =>
        {
          const next = prev.map((entry) =>
            entry.id === editUserId
              ? {
                  ...entry,
                  name: nextName || entry.name,
                  phone: nextPhone || entry.phone,
                }
              : entry,
          );
          writeSignedUsersSnapshot(next);
          return next;
        },
      );
      setEditDialogOpen(false);
      toast.success("User updated");
    },
    notifyUnsupportedUserAction: (message: string) => {
      toast.error(message);
    },
  };
}
