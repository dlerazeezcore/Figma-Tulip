import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { isBackendCapabilityEnabled } from "./config";
import { requestApi } from "./http";
import {
  addAuthSessionChangeListener,
  getAccountUserId,
  getAdminUserId,
  getAuthSubjectType,
  getUserId,
  isAdmin as hasAdminAccess,
  isAuthenticated,
} from "./session";
import type { ApiResponse } from "./types";

export interface SupportConversation {
  id: string;
  customer_user_id: string;
  customer_display_name: string;
  status: "open" | "closed" | "pending";
  source: string;
  telegram_chat_id?: string | null;
  telegram_thread_id?: number | null;
  latest_customer_message_preview: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

export interface SupportMessage {
  id: string;
  conversation_id: string;
  sender_type: "user" | "admin" | "support" | "system";
  sender_user_id: string;
  sender_admin_user_id?: string;
  sender_display_name: string;
  body: string;
  status?: string;
  pushDeliveryStatus?: string;
  direction?:
    | "admin_to_user"
    | "user_to_support"
    | "admin_to_support"
    | "support_to_user"
    | "support_to_admin";
  is_from_current_actor?: boolean;
  user_id?: string;
  admin_user_id?: string;
  message?: string;
  createdAt?: string;
  telegram_chat_id?: string | null;
  telegram_message_id?: number | null;
  reply_to_telegram_message_id?: number | null;
  metadata?: Record<string, unknown>;
  attachments?: SupportMessageAttachmentPayload[];
  created_at: string;
}

export interface SupportAttachment {
  url?: string;
  urlCandidates?: string[];
  name?: string;
  mimeType?: string;
  size?: number;
  isImage?: boolean;
  source?: string;
  objectPath?: string;
}

interface SupportUploadPresignPayload {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

interface SupportUploadDescriptor {
  bucket?: string;
  objectPath: string;
  publicUrl: string;
  uploadUrl: string;
  method?: string;
  requiredHeaders?: Record<string, string>;
  expiresInSeconds?: number;
  maxFileBytes?: number;
}

interface SupportSendAttachmentPayload {
  objectPath: string;
  publicUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

interface SupportMessageAttachmentPayload {
  objectPath?: string;
  publicUrl?: string;
  url?: string;
  fileName?: string;
  contentType?: string;
  mimeType?: string;
  sizeBytes?: number;
  size?: number;
  source?: string;
}

export interface SupportConversationResponse {
  conversation: SupportConversation | null;
  messages: SupportMessage[];
}

interface LoadSupportConversationOptions {
  signal?: AbortSignal;
}

export interface SupportChatMessage {
  id: string;
  content: string;
  senderType: "user" | "admin" | "support" | "system";
  senderLabel: string;
  senderAvatar: string;
  isFromCurrentActor: boolean;
  direction?:
    | "admin_to_user"
    | "user_to_support"
    | "admin_to_support"
    | "support_to_user"
    | "support_to_admin";
  userId?: string;
  adminUserId?: string;
  timestamp: Date;
  status?: "sending" | "sent" | "failed";
  rawStatus?: string;
  pushDeliveryStatus?: string;
  hasDeliveryWarning?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  attachments?: SupportAttachment[];
}

export interface SupportPageModel {
  messages: SupportChatMessage[];
  inputValue: string;
  imagePreviewUrl: string | null;
  isLoading: boolean;
  isSending: boolean;
  showAuthModal: boolean;
  requiresAuth: boolean;
  hasMessages: boolean;
  supportTyping: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  scrollMessagesToBottom: () => void;
  setInputValue: (value: string) => void;
  navigateBack: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  handleAuthSuccess: () => Promise<void>;
  handleSendCurrentMessage: () => Promise<void>;
  handleQuickAction: (action: string) => void;
  handleRetry: (message: SupportChatMessage) => void;
  handleAttachmentClick: () => void;
  handleFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  handleInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

const SUPPORT_POLL_INTERVAL_MS = 12_000;
const SUPPORT_POLL_INACTIVE_INTERVAL_MS = 30_000;
const SUPPORT_POLL_FAST_INTERVAL_MS = 3_000;
const SUPPORT_POLL_FAST_WINDOW_MS = 15_000;
const SUPPORT_POLL_BACKOFF_MS = [2_000, 5_000, 10_000] as const;
const SUPPORT_ATTACHMENT_URL_MAX_CANDIDATES = 3;
const MAX_SUPPORT_ATTACHMENTS = 5;
const DEFAULT_SUPPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_SUPPORT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const SUPPORT_UPLOAD_BUCKET_HINT_KEY = "supportUploadBucketHint";
const SUPPORT_UPLOAD_ORIGIN_HINT_KEY = "supportUploadOriginHint";
let hasShownAdminTokenWarning = false;

function readStorageHint(key: string): string {
  try {
    return String(localStorage.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function writeStorageHint(key: string, value: string): void {
  try {
    if (value) {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage write failures in constrained environments.
  }
}

function normalizeSupportImageContentType(rawType: string): string {
  const normalized = String(rawType || "").trim().toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
}

function getSupportFileContentType(file: File): string {
  const normalized = normalizeSupportImageContentType(file.type);
  if (normalized) {
    return normalized;
  }
  const lowerName = String(file.name || "").toLowerCase();
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerName.endsWith(".png")) {
    return "image/png";
  }
  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowerName.endsWith(".heic")) {
    return "image/heic";
  }
  if (lowerName.endsWith(".heif")) {
    return "image/heif";
  }
  return "";
}

function isAllowedSupportImage(file: File): boolean {
  const contentType = getSupportFileContentType(file);
  return ALLOWED_SUPPORT_IMAGE_TYPES.has(contentType);
}

interface SupportTargetingParams {
  userId: string;
  targetUserId: string;
  threadUserId: string;
  conversationUserId: string;
  supportMessageId: string;
  replyToTelegramMessageId: string;
}

function readSupportTargetingParamsFromLocation(): SupportTargetingParams {
  const empty: SupportTargetingParams = {
    userId: "",
    targetUserId: "",
    threadUserId: "",
    conversationUserId: "",
    supportMessageId: "",
    replyToTelegramMessageId: "",
  };
  if (typeof window === "undefined") {
    return empty;
  }

  try {
    const params = new URLSearchParams(window.location.search || "");
    return {
      userId: String(params.get("userId") || "").trim(),
      targetUserId: String(params.get("targetUserId") || "").trim(),
      threadUserId: String(params.get("threadUserId") || "").trim(),
      conversationUserId: String(params.get("conversationUserId") || "").trim(),
      supportMessageId: String(params.get("supportMessageId") || "").trim(),
      replyToTelegramMessageId: String(params.get("replyToTelegramMessageId") || "").trim(),
    };
  } catch {
    return empty;
  }
}

interface SupportRequestContext {
  isAdmin: boolean;
  requestMode: "user" | "admin_thread" | "admin_self";
  authSubjectType: "admin" | "user" | "unknown";
  actorUserId: string;
  actorAdminUserId: string;
  selectedUserId: string;
  targeting: SupportTargetingParams;
  authSubject: "admin" | "user" | "unknown";
  hasTargetUserId: boolean;
  hasAdminTokenMismatch: boolean;
}

function warnAdminTokenMismatch(message: string): void {
  if (!message) {
    return;
  }
  console.warn("[support] admin-token-mismatch", { message });
  if (hasShownAdminTokenWarning) {
    return;
  }
  hasShownAdminTokenWarning = true;
  toast.warning(message);
}

function resolveSupportRequestContext(): SupportRequestContext {
  const subjectType = getAuthSubjectType();
  const isAdminFlag = hasAdminAccess();
  const targeting = readSupportTargetingParamsFromLocation();
  const selectedUserId = targeting.userId || targeting.targetUserId;
  const hasTargetUserId =
    Boolean(selectedUserId) ||
    Boolean(targeting.threadUserId) ||
    Boolean(targeting.conversationUserId) ||
    Boolean(targeting.supportMessageId) ||
    Boolean(targeting.replyToTelegramMessageId);
  const adminMode = subjectType === "admin" || isAdminFlag;
  const authSubject: "admin" | "user" | "unknown" =
    subjectType === "admin" || subjectType === "user" ? subjectType : subjectType === "" ? "unknown" : "unknown";
  const actorUserId = String(getAccountUserId() || getUserId() || "").trim();
  const actorAdminUserId = String(getAdminUserId() || getUserId() || "").trim();

  const hasAdminTokenMismatch = hasTargetUserId && !adminMode;
  const requestMode: SupportRequestContext["requestMode"] = adminMode
    ? hasTargetUserId
      ? "admin_thread"
      : "admin_self"
    : "user";
  return {
    isAdmin: adminMode,
    requestMode,
    authSubjectType:
      authSubject === "admin" || authSubject === "user" ? authSubject : "unknown",
    actorUserId,
    actorAdminUserId,
    selectedUserId,
    targeting,
    authSubject,
    hasTargetUserId,
    hasAdminTokenMismatch,
  };
}

function normalizeSenderType(message: any): "user" | "admin" | "support" | "system" {
  const senderType = String(
    message?.senderType ??
      message?.sender_type ??
      message?.sender ??
      "",
  ).trim().toLowerCase();
  if (senderType === "user" || senderType === "admin" || senderType === "support" || senderType === "system") {
    return senderType;
  }
  if (senderType === "customer") {
    return "user";
  }

  const direction = String(message?.direction || "").trim().toLowerCase();
  if (direction === "admin_to_user" && senderType === "support") {
    return "support";
  }
  if (direction === "admin_to_user") {
    return "admin";
  }
  if (direction === "user_to_support") {
    return "user";
  }
  if (direction === "admin_to_support") {
    return "admin";
  }
  if (direction === "support_to_user" || direction === "support_to_admin") {
    return "support";
  }
  if (direction === "user_to_admin") {
    return "user";
  }

  return "system";
}

function normalizeDirection(
  raw: unknown,
):
  | "admin_to_user"
  | "user_to_support"
  | "admin_to_support"
  | "support_to_user"
  | "support_to_admin"
  | undefined {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "user_to_admin") {
    return "user_to_support";
  }
  if (value === "admin_to_user") {
    return "admin_to_user";
  }
  if (value === "user_to_support") {
    return "user_to_support";
  }
  if (value === "admin_to_support") {
    return "admin_to_support";
  }
  if (value === "support_to_user") {
    return "support_to_user";
  }
  if (value === "support_to_admin") {
    return "support_to_admin";
  }
  return undefined;
}

function normalizeOptionalBoolean(raw: unknown): boolean | undefined {
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

function normalizeSupportAttachments(rawValue: unknown): SupportMessageAttachmentPayload[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const objectPath = String(record.objectPath ?? record.object_path ?? "").trim() || undefined;
      const publicUrl =
        String(
          record.publicUrl ??
            record.public_url ??
            record.downloadUrl ??
            record.download_url ??
            "",
        ).trim() || undefined;
      const directUrl =
        String(
          record.url ??
            record.fileUrl ??
            record.file_url ??
            record.telegramFileUrl ??
            record.telegram_file_url ??
            record.previewUrl ??
            record.preview_url ??
            "",
        ).trim() || undefined;
      const fileName = String(record.fileName ?? record.file_name ?? "").trim() || undefined;
      const contentType = normalizeSupportImageContentType(
        String(
          record.contentType ??
            record.content_type ??
            record.mimeType ??
            record.mime_type ??
            record.fileType ??
            record.file_type ??
            "",
        ),
      ) || undefined;
      const sizeBytesRaw = Number(record.sizeBytes ?? record.size_bytes ?? record.size);
      const sizeBytes = Number.isFinite(sizeBytesRaw) && sizeBytesRaw >= 0 ? sizeBytesRaw : undefined;
      const source = String(record.source ?? "").trim() || undefined;

      if (!objectPath && !publicUrl && !directUrl) {
        return null;
      }

      return {
        objectPath,
        publicUrl: publicUrl ?? directUrl,
        url: directUrl,
        fileName,
        contentType,
        sizeBytes,
        source,
      } satisfies SupportMessageAttachmentPayload;
    })
    .filter((item): item is SupportMessageAttachmentPayload => Boolean(item));
}

function normalizeSupportAttachmentsFromMetadata(metadata: unknown): SupportMessageAttachmentPayload[] {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }
  const record = metadata as Record<string, unknown>;
  const candidates: unknown[] = [];

  if (Array.isArray(record.attachments)) {
    candidates.push(record.attachments);
  }
  if (Array.isArray(record.files)) {
    candidates.push(record.files);
  }
  if (record.attachment && typeof record.attachment === "object") {
    candidates.push([record.attachment]);
  }
  if (record.photo && typeof record.photo === "object") {
    candidates.push([record.photo]);
  }
  if (record.image && typeof record.image === "object") {
    candidates.push([record.image]);
  }
  if (Array.isArray(record.photos)) {
    candidates.push(record.photos);
  }
  if (record.file && typeof record.file === "object") {
    candidates.push([record.file]);
  }
  const directUrlKeys = [
    "url",
    "publicUrl",
    "public_url",
    "fileUrl",
    "file_url",
    "telegramFileUrl",
    "telegram_file_url",
    "downloadUrl",
    "download_url",
    "imageUrl",
    "image_url",
    "photoUrl",
    "photo_url",
  ];
  directUrlKeys.forEach((key) => {
    const value = String(record[key] ?? "").trim();
    if (!value) {
      return;
    }
    candidates.push([
      {
        url: value,
        publicUrl: value,
        fileName: String(record.fileName ?? record.file_name ?? "").trim() || undefined,
        contentType: String(record.contentType ?? record.content_type ?? record.mimeType ?? record.mime_type ?? "").trim() || undefined,
      },
    ]);
  });

  const flattened = candidates.flatMap((value) => (Array.isArray(value) ? value : []));
  return normalizeSupportAttachments(flattened);
}

const ATTACHMENT_ONLY_MESSAGE_MARKERS = new Set([
  "[attachment only]",
  "(attachment only)",
  "attachment only",
]);

function sanitizeSupportMessageContent(rawText: string, attachments: SupportAttachment[]): string {
  const normalized = String(rawText || "").trim();
  if (!normalized) {
    return "";
  }
  if (attachments.length === 0) {
    return normalized;
  }
  const lowered = normalized.toLowerCase();
  if (ATTACHMENT_ONLY_MESSAGE_MARKERS.has(lowered)) {
    return "";
  }
  return normalized;
}

function normalizeSupportMessageRow(message: any): SupportMessage {
  const id = String(message?.id || "").trim();
  const senderType = normalizeSenderType(message);
  const direction = normalizeDirection(message?.direction);
  const body = String(
    message?.body ??
      message?.text ??
      message?.content ??
      message?.message_text ??
      message?.message ??
      "",
  ).trim();
  const createdAt = String(message?.created_at || message?.createdAt || "").trim();
  const status = String(message?.status || "").trim();
  const pushDeliveryStatus = String(
    message?.pushDeliveryStatus ??
      message?.push_delivery_status ??
      "",
  ).trim();
  const fromPayload = normalizeSupportAttachments(message?.attachments ?? []);
  const fromMetadata = normalizeSupportAttachmentsFromMetadata(message?.metadata);
  const attachmentMap = new Map<string, SupportMessageAttachmentPayload>();
  [...fromPayload, ...fromMetadata].forEach((attachment) => {
    const key = [
      attachment.objectPath || "",
      attachment.publicUrl || "",
      attachment.url || "",
      attachment.fileName || "",
    ].join("|");
    if (!key) {
      return;
    }
    if (!attachmentMap.has(key)) {
      attachmentMap.set(key, attachment);
    }
  });
  const attachments = Array.from(attachmentMap.values());

  return {
    id,
    conversation_id: String(message?.conversationId ?? message?.conversation_id ?? "").trim(),
    sender_type: senderType,
    sender_user_id: String(
      message?.sender_user_id ??
        message?.senderUserId ??
        "",
    ).trim(),
    sender_admin_user_id: String(
      message?.sender_admin_user_id ??
        message?.senderAdminUserId ??
        message?.admin_user_id ??
        message?.adminUserId ??
        "",
    ).trim() || undefined,
    sender_display_name: String(message?.sender_display_name || "").trim(),
    body,
    status: status || undefined,
    pushDeliveryStatus: pushDeliveryStatus || undefined,
    direction,
    is_from_current_actor: normalizeOptionalBoolean(
      message?.is_from_current_actor ?? message?.isFromCurrentActor,
    ),
    user_id: String(message?.user_id ?? message?.userId ?? "").trim() || undefined,
    admin_user_id: String(message?.admin_user_id ?? message?.adminUserId ?? "").trim() || undefined,
    message: String(message?.message || "").trim() || undefined,
    createdAt: createdAt || undefined,
    telegram_chat_id:
      message?.telegram_chat_id === null || message?.telegram_chat_id === undefined
        ? undefined
        : String(message.telegram_chat_id),
    telegram_message_id:
      typeof message?.telegram_message_id === "number"
        ? message.telegram_message_id
        : typeof message?.telegramMessageId === "number"
        ? message.telegramMessageId
        : undefined,
    reply_to_telegram_message_id:
      typeof message?.reply_to_telegram_message_id === "number"
        ? message.reply_to_telegram_message_id
        : undefined,
    metadata: message?.metadata && typeof message.metadata === "object" ? message.metadata : undefined,
    attachments,
    created_at: createdAt || new Date().toISOString(),
  };
}

function extractSupportMessageRows(response: ApiResponse<any>): any[] {
  const payload = response?.data;
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [
    payload.messages,
    payload.data?.messages,
    payload.items,
    payload.rows,
    payload.data,
    payload.obj?.messages,
    payload.obj?.data?.messages,
    payload.obj?.items,
    payload.obj?.rows,
    payload.obj?.data,
    payload.result?.messages,
    payload.result?.data?.messages,
    payload.result?.items,
    payload.result?.rows,
    payload.result?.data,
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function matchesUserActor(message: SupportMessage, userId: string): boolean {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return false;
  }

  return [
    String(message.sender_user_id || "").trim(),
    String(message.user_id || "").trim(),
  ].includes(normalizedUserId);
}

function matchesAdminActor(message: SupportMessage, adminUserId: string): boolean {
  const normalizedAdminUserId = String(adminUserId || "").trim();
  if (!normalizedAdminUserId) {
    return false;
  }

  return [
    String(message.sender_admin_user_id || "").trim(),
    String(message.admin_user_id || "").trim(),
  ].includes(normalizedAdminUserId);
}
function scopeMessagesByConversationId(
  messages: SupportMessage[],
  expectedConversationId: string,
): {
  scoped: SupportMessage[];
  selectedConversationId: string;
  reason: "conversation_scope" | "strict_empty" | "missing_conversation_id";
} {
  const normalizedConversationId = String(expectedConversationId || "").trim();
  if (!normalizedConversationId) {
    return { scoped: [], selectedConversationId: "", reason: "missing_conversation_id" };
  }

  const scoped = messages.filter(
    (message) => String(message.conversation_id || "").trim() === normalizedConversationId,
  );
  if (scoped.length > 0) {
    return {
      scoped,
      selectedConversationId: normalizedConversationId,
      reason: "conversation_scope",
    };
  }

  return { scoped: [], selectedConversationId: normalizedConversationId, reason: "strict_empty" };
}

function getExpectedConversationId(context: SupportRequestContext): string {
  if (context.requestMode === "admin_thread") {
    return context.selectedUserId ? `user:${context.selectedUserId}` : "";
  }
  if (context.requestMode === "admin_self") {
    return context.actorAdminUserId ? `admin:${context.actorAdminUserId}` : "";
  }
  return context.actorUserId ? `user:${context.actorUserId}` : "";
}

function isEmptyConversationError(error: string): boolean {
  const text = String(error || "").toLowerCase();
  return (
    text.includes("no support conversation") ||
    text.includes("no support messages") ||
    text.includes("conversation is empty")
  );
}

export async function loadSupportConversation(
  options: LoadSupportConversationOptions = {},
): Promise<ApiResponse<SupportConversationResponse>> {
  if (!isBackendCapabilityEnabled("supportChat")) {
    return {
      success: true,
      data: {
        conversation: null,
        messages: [],
      },
    };
  }

  const context = resolveSupportRequestContext();
  if (context.hasAdminTokenMismatch) {
    const warning =
      "Admin support thread requested with a non-admin token. Please sign in with an admin account.";
    warnAdminTokenMismatch(warning);
    return {
      success: false,
      error: warning,
    };
  }

  console.info("[support] request", {
    method: "GET",
    path: "/api/v1/support/telegram/messages",
    authSubject: context.authSubject,
    isAdmin: context.isAdmin,
    requestMode: context.requestMode,
    hasScopedUserId: Boolean(context.requestMode === "admin_thread" && context.selectedUserId),
    limit: 50,
    offset: 0,
  });
  const response = await requestApi<{ messages?: any[] }>("/support/telegram/messages", {
    query: {
      limit: 50,
      offset: 0,
      userId: context.requestMode === "admin_thread" && context.selectedUserId ? context.selectedUserId : undefined,
    },
    includeAuth: true,
    timeoutMs: 20_000,
    signal: options.signal,
  });
  console.info("[support] response", {
    method: "GET",
    path: "/api/v1/support/telegram/messages",
    authSubject: context.authSubject,
    status: response.success ? "ok" : "error",
    error: response.success ? undefined : response.error,
    messageCount: response.success ? extractSupportMessageRows(response).length : undefined,
  });

  if (response.success) {
    const rows = extractSupportMessageRows(response);
    const normalized = rows.map(normalizeSupportMessageRow);
    const expectedConversationId = getExpectedConversationId(context);
    const conversationScope = scopeMessagesByConversationId(
      normalized,
      expectedConversationId,
    );
    if (
      normalized.length > 0 &&
      expectedConversationId &&
      !normalized.some((message) => String(message.conversation_id || "").trim())
    ) {
      return {
        success: false,
        error: "Support thread metadata is incomplete. Backend must return conversationId for each message.",
      };
    }
    const filtered = conversationScope.scoped;
    normalized.sort((a, b) => {
      const aTime = Date.parse(String(a.created_at || ""));
      const bTime = Date.parse(String(b.created_at || ""));
      return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    });
    filtered.sort((a, b) => {
      const aTime = Date.parse(String(a.created_at || ""));
      const bTime = Date.parse(String(b.created_at || ""));
      return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    });
    console.info("[support] conversation-scope", {
      authSubject: context.authSubject,
      isAdmin: context.isAdmin,
      requestMode: context.requestMode,
      userId: context.actorUserId || undefined,
      adminUserId: context.actorAdminUserId || undefined,
      selectedConversationId:
        conversationScope.selectedConversationId || undefined,
      scopeReason: conversationScope.reason,
      fetchedRows: normalized.length,
      scopedRows: filtered.length,
    });

    return {
      success: true,
      data: {
        conversation: null,
        messages: filtered,
      },
    };
  }

  if (isEmptyConversationError(response.error || "")) {
    return {
      success: true,
      data: {
        conversation: null,
        messages: [],
      },
    };
  }

  return {
    success: false,
    error: response.error || "Unable to load support conversation.",
  };
}

async function presignSupportUpload(file: File): Promise<ApiResponse<SupportUploadDescriptor>> {
  const contentType = getSupportFileContentType(file);
  if (!ALLOWED_SUPPORT_IMAGE_TYPES.has(contentType)) {
    return {
      success: false,
      error: `${file.name}: unsupported file type.`,
    };
  }

  const payload: SupportUploadPresignPayload = {
    fileName: String(file.name || "attachment").trim() || "attachment",
    contentType,
    sizeBytes: Number(file.size || 0),
  };

  const response = await requestApi<any>("/support/uploads/presign", {
    method: "POST",
    body: payload,
    includeAuth: true,
    timeoutMs: 30_000,
  });

  if (!response.success) {
    return {
      success: false,
      error: response.error || `${file.name}: unable to prepare upload.`,
    };
  }

  const upload = response.data?.upload || response.data?.data?.upload;
  if (!upload || typeof upload !== "object") {
    return {
      success: false,
      error: `${file.name}: invalid upload response from server.`,
    };
  }

  const descriptor: SupportUploadDescriptor = {
    bucket: typeof upload.bucket === "string" ? upload.bucket : undefined,
    objectPath: String(upload.objectPath || "").trim(),
    publicUrl: String(upload.publicUrl || "").trim(),
    uploadUrl: String(upload.uploadUrl || "").trim(),
    method: String(upload.method || "PUT").trim().toUpperCase() || "PUT",
    requiredHeaders:
      upload.requiredHeaders && typeof upload.requiredHeaders === "object"
        ? (upload.requiredHeaders as Record<string, string>)
        : undefined,
    expiresInSeconds: Number(upload.expiresInSeconds),
    maxFileBytes: Number(upload.maxFileBytes),
  };

  if (!descriptor.objectPath || !descriptor.publicUrl || !descriptor.uploadUrl) {
    return {
      success: false,
      error: `${file.name}: upload link response is incomplete.`,
    };
  }

  rememberUploadStorageHints(descriptor);

  return {
    success: true,
    data: descriptor,
  };
}

async function uploadSupportFileToStorage(
  file: File,
  descriptor: SupportUploadDescriptor,
): Promise<ApiResponse<SupportSendAttachmentPayload>> {
  const contentType = getSupportFileContentType(file);
  const maxFileBytes =
    Number.isFinite(Number(descriptor.maxFileBytes)) && Number(descriptor.maxFileBytes) > 0
      ? Number(descriptor.maxFileBytes)
      : DEFAULT_SUPPORT_MAX_FILE_BYTES;
  if (file.size > maxFileBytes) {
    return {
      success: false,
      error: `${file.name}: file is larger than the allowed ${Math.floor(maxFileBytes / (1024 * 1024))}MB.`,
    };
  }

  const headers: Record<string, string> = {};
  if (descriptor.requiredHeaders && typeof descriptor.requiredHeaders === "object") {
    Object.entries(descriptor.requiredHeaders).forEach(([key, value]) => {
      if (!key || value == null) {
        return;
      }
      headers[key] = String(value);
    });
  }
  if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
    headers["Content-Type"] = contentType;
  }

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(descriptor.uploadUrl, {
      method: descriptor.method || "PUT",
      headers,
      body: file,
    });
  } catch (error) {
    return {
      success: false,
      error:
        `${file.name}: upload request failed. ` +
        (error instanceof Error ? error.message : "Please try again."),
    };
  }

  if (!uploadResponse.ok) {
    let uploadError = "";
    try {
      uploadError = (await uploadResponse.text()).trim();
    } catch {
      uploadError = "";
    }
    return {
      success: false,
      error:
        `${file.name}: upload failed with status ${uploadResponse.status}` +
        (uploadError ? ` (${uploadError.slice(0, 200)})` : "."),
    };
  }

  return {
    success: true,
    data: {
      objectPath: descriptor.objectPath,
      publicUrl: descriptor.publicUrl,
      fileName: String(file.name || "").trim() || "attachment",
      contentType,
      sizeBytes: Number(file.size || 0),
    },
  };
}

async function uploadSupportAttachments(files: File[]): Promise<ApiResponse<SupportSendAttachmentPayload[]>> {
  if (files.length > MAX_SUPPORT_ATTACHMENTS) {
    return {
      success: false,
      error: `You can attach up to ${MAX_SUPPORT_ATTACHMENTS} images per message.`,
    };
  }

  const uploaded: SupportSendAttachmentPayload[] = [];
  for (const file of files) {
    if (!isAllowedSupportImage(file)) {
      return {
        success: false,
        error: `${file.name}: unsupported file type. Allowed: JPEG, PNG, WebP, HEIC, HEIF.`,
      };
    }

    const presign = await presignSupportUpload(file);
    if (!presign.success || !presign.data) {
      return {
        success: false,
        error: presign.error || `${file.name}: failed to get upload URL.`,
      };
    }

    const uploadedFile = await uploadSupportFileToStorage(file, presign.data);
    if (!uploadedFile.success || !uploadedFile.data) {
      return {
        success: false,
        error: uploadedFile.error || `${file.name}: failed to upload.`,
      };
    }

    uploaded.push(uploadedFile.data);
  }

  return {
    success: true,
    data: uploaded,
  };
}

export async function sendSupportMessage(
  body: string,
  files?: File[] | File | null,
): Promise<ApiResponse<SupportConversationResponse>> {
  if (!isBackendCapabilityEnabled("supportChat")) {
    return {
      success: false,
      error: "Support chat is not available in backendformobileapp yet.",
    };
  }

  const trimmedBody = String(body || "").trim();
  const normalizedFiles = Array.isArray(files)
    ? files.filter((file): file is File => file instanceof File)
    : files instanceof File
    ? [files]
    : [];
  if (!trimmedBody && normalizedFiles.length === 0) {
    return {
      success: false,
      error: "Message or image attachment is required.",
    };
  }
  if (normalizedFiles.length > MAX_SUPPORT_ATTACHMENTS) {
    return {
      success: false,
      error: `You can attach up to ${MAX_SUPPORT_ATTACHMENTS} images per message.`,
    };
  }

  const context = resolveSupportRequestContext();
  if (context.hasAdminTokenMismatch) {
    const warning =
      "Admin support send requested with a non-admin token. Please sign in with an admin account.";
    warnAdminTokenMismatch(warning);
    return {
      success: false,
      error: warning,
    };
  }
  const hasFallbackAdminTarget =
    Boolean(context.targeting.targetUserId) ||
    Boolean(context.targeting.threadUserId) ||
    Boolean(context.targeting.conversationUserId) ||
    Boolean(context.targeting.supportMessageId) ||
    Boolean(context.targeting.replyToTelegramMessageId);
  if (context.requestMode === "admin_thread" && !context.selectedUserId && !hasFallbackAdminTarget) {
    return {
      success: false,
      error: "userId is required: select a conversation/user before sending.",
    };
  }

  let attachments: SupportSendAttachmentPayload[] = [];
  if (normalizedFiles.length > 0) {
    const uploadResult = await uploadSupportAttachments(normalizedFiles);
    if (!uploadResult.success || !uploadResult.data) {
      return {
        success: false,
        error: uploadResult.error || "Image upload failed. Please try again.",
      };
    }
    attachments = uploadResult.data;
  }

  const payload = context.requestMode === "admin_thread"
    ? {
        userId: context.selectedUserId || undefined,
        targetUserId: context.targeting.targetUserId || undefined,
        threadUserId: context.targeting.threadUserId || undefined,
        conversationUserId: context.targeting.conversationUserId || undefined,
        supportMessageId: context.targeting.supportMessageId || undefined,
        replyToTelegramMessageId: context.targeting.replyToTelegramMessageId || undefined,
        message: trimmedBody,
        ...(attachments.length > 0 ? { attachments } : {}),
      }
    : {
        message: trimmedBody,
        ...(attachments.length > 0 ? { attachments } : {}),
      };

  console.info("[support] request", {
    method: "POST",
    path: "/api/v1/support/telegram/messages",
    authSubject: context.authSubject,
    isAdmin: context.isAdmin,
    requestMode: context.requestMode,
    hasMessageBody: Boolean(trimmedBody),
    attachmentCount: attachments.length,
    hasScopedUserId: Boolean(context.requestMode === "admin_thread" && context.selectedUserId),
  });
  const response = await requestApi<any>("/support/telegram/messages", {
    method: "POST",
    body: payload,
    includeAuth: true,
    timeoutMs: 30_000,
  });
  console.info("[support] response", {
    method: "POST",
    path: "/api/v1/support/telegram/messages",
    authSubject: context.authSubject,
    status: response.success ? "ok" : "error",
    error: response.success ? undefined : response.error,
    returnedMessage:
      response.success &&
      Boolean(
        response.data?.message ??
          response.data?.data?.message ??
          (response.data && typeof response.data === "object" && "id" in response.data),
      ),
  });

  if (response.success) {
    const responseMessage =
      response.data?.message ??
      response.data?.data?.message ??
      (response.data && typeof response.data === "object" && "id" in response.data ? response.data : null);
    const row = responseMessage ? normalizeSupportMessageRow(responseMessage) : null;
    return {
      success: true,
      data: {
        conversation: null,
        messages: row ? [row] : [],
      },
    };
  }

  return {
    success: false,
    error: response.error || "Unable to send support message.",
  };
}

function isImageByExtension(value?: string): boolean {
  const normalized = String(value || "").toLowerCase().split("?")[0].split("#")[0];
  return (
    normalized.endsWith(".jpg") ||
    normalized.endsWith(".jpeg") ||
    normalized.endsWith(".png") ||
    normalized.endsWith(".webp") ||
    normalized.endsWith(".heic") ||
    normalized.endsWith(".heif")
  );
}

interface StoragePublicUrlParts {
  origin: string;
  bucket: string;
  objectPath: string;
}

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractStoragePublicUrlParts(url?: string): StoragePublicUrlParts | null {
  const raw = String(url || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    const marker = "/storage/v1/object/public/";
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    const suffix = parsed.pathname.slice(markerIndex + marker.length);
    const firstSlash = suffix.indexOf("/");
    if (firstSlash <= 0) {
      return null;
    }

    const bucket = safeDecodeUriComponent(suffix.slice(0, firstSlash));
    const objectPath = safeDecodeUriComponent(suffix.slice(firstSlash + 1)).replace(/^\/+/, "");
    if (!bucket || !objectPath) {
      return null;
    }
    return {
      origin: parsed.origin,
      bucket,
      objectPath,
    };
  } catch {
    return null;
  }
}

function buildStoragePublicUrl(origin: string, bucket: string, objectPath: string): string {
  const normalizedOrigin = String(origin || "").trim().replace(/\/+$/, "");
  const encodedBucket = encodeURIComponent(String(bucket || "").trim());
  const encodedPath = String(objectPath || "")
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(safeDecodeUriComponent(segment || "")))
    .join("/");
  return `${normalizedOrigin}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;
}

function bucketVariants(bucket: string): string[] {
  const base = String(bucket || "").trim();
  if (!base) {
    return [];
  }
  const normalizedSpace = base.replace(/\s+/g, " ").trim();
  const variants = [normalizedSpace, normalizedSpace.replace(/\s+/g, "-")];
  return Array.from(new Set(variants.filter(Boolean)));
}

function buildAttachmentUrlCandidates(url?: string, objectPath?: string): string[] {
  const candidates: string[] = [];
  const direct = String(url || "").trim();
  if (direct) {
    candidates.push(direct);
  }

  const parts = extractStoragePublicUrlParts(direct);
  if (parts) {
    bucketVariants(parts.bucket).forEach((bucket) => {
      candidates.push(buildStoragePublicUrl(parts.origin, bucket, parts.objectPath));
    });
  }

  const path = String(objectPath || "").trim().replace(/^\/+/, "");
  if (path) {
    const hintedOrigin = readStorageHint(SUPPORT_UPLOAD_ORIGIN_HINT_KEY);
    const hintedBucket = readStorageHint(SUPPORT_UPLOAD_BUCKET_HINT_KEY);
    if (hintedOrigin && hintedBucket) {
      bucketVariants(hintedBucket).forEach((bucket) => {
        candidates.push(buildStoragePublicUrl(hintedOrigin, bucket, path));
      });
    }
  }

  return Array.from(new Set(candidates.filter(Boolean))).slice(0, SUPPORT_ATTACHMENT_URL_MAX_CANDIDATES);
}

function rememberUploadStorageHints(descriptor: SupportUploadDescriptor): void {
  const bucket = String(descriptor.bucket || "").trim();
  if (bucket) {
    writeStorageHint(SUPPORT_UPLOAD_BUCKET_HINT_KEY, bucket);
  }

  const uploadUrl = String(descriptor.uploadUrl || "").trim();
  if (uploadUrl) {
    try {
      const parsed = new URL(uploadUrl);
      if (parsed.origin) {
        writeStorageHint(SUPPORT_UPLOAD_ORIGIN_HINT_KEY, parsed.origin);
      }
    } catch {
      // Ignore malformed URL.
    }
  }

  const publicParts = extractStoragePublicUrlParts(String(descriptor.publicUrl || "").trim());
  if (publicParts?.origin) {
    writeStorageHint(SUPPORT_UPLOAD_ORIGIN_HINT_KEY, publicParts.origin);
  }
}

function isImageAttachment(
  mimeType?: string,
  url?: string,
  fileName?: string,
  objectPath?: string,
): boolean {
  const normalizedMime = normalizeSupportImageContentType(String(mimeType || ""));
  if (normalizedMime.startsWith("image/")) {
    return true;
  }

  if (isImageByExtension(url)) {
    return true;
  }
  if (isImageByExtension(fileName)) {
    return true;
  }
  if (isImageByExtension(objectPath)) {
    return true;
  }

  return false;
}

export function getSupportMessageAttachments(message: SupportMessage): SupportAttachment[] {
  const fromAttachments = Array.isArray(message.attachments)
    ? message.attachments
      .map((attachment) => {
          const rawUrl = String(attachment.publicUrl ?? attachment.url ?? "").trim() || undefined;
          const mimeType = normalizeSupportImageContentType(
            String(attachment.contentType ?? attachment.mimeType ?? ""),
          ) || undefined;
          const sizeRaw = Number(attachment.sizeBytes ?? attachment.size);
          const objectPath = String(attachment.objectPath ?? "").trim() || undefined;
          const fileName = String(attachment.fileName || "").trim() || undefined;
          if (!rawUrl && !objectPath && !fileName) {
            return null;
          }
          const urlCandidates = buildAttachmentUrlCandidates(rawUrl, objectPath);
          const primaryUrl = urlCandidates[0] || rawUrl;
          return {
            url: primaryUrl,
            urlCandidates,
            name: fileName,
            mimeType,
            size: Number.isFinite(sizeRaw) && sizeRaw >= 0 ? sizeRaw : undefined,
            isImage: isImageAttachment(mimeType, primaryUrl, fileName, objectPath),
            source: String(attachment.source || "").trim() || undefined,
            objectPath,
          } satisfies SupportAttachment;
        })
        .filter((attachment): attachment is SupportAttachment => Boolean(attachment))
    : [];

  if (fromAttachments.length > 0) {
    return fromAttachments;
  }

  const metadataAttachment =
    message?.metadata && typeof message.metadata === "object"
      ? (message.metadata as Record<string, unknown>).attachment
      : null;
  if (!metadataAttachment || typeof metadataAttachment !== "object") {
    return [];
  }

  const attachmentRecord = metadataAttachment as Record<string, unknown>;
  const rawUrl = String(attachmentRecord.url || "").trim();
  const objectPath = String(attachmentRecord.objectPath || attachmentRecord.object_path || "").trim() || undefined;
  const fileName =
    String(attachmentRecord.name || attachmentRecord.fileName || attachmentRecord.file_name || "").trim() ||
    undefined;
  const urlCandidates = buildAttachmentUrlCandidates(rawUrl, objectPath);
  const primaryUrl = urlCandidates[0] || rawUrl;
  if (!primaryUrl && !objectPath && !fileName) {
    return [];
  }

  return [
    {
      url: primaryUrl || undefined,
      urlCandidates,
      name: fileName,
      mimeType: String(attachmentRecord.mimeType || attachmentRecord.mime_type || "").trim() || undefined,
      size:
        typeof attachmentRecord.size === "number"
          ? attachmentRecord.size
          : Number.isFinite(Number(attachmentRecord.size))
          ? Number(attachmentRecord.size)
          : undefined,
      isImage: isImageAttachment(
        String(attachmentRecord.mimeType || attachmentRecord.mime_type || ""),
        primaryUrl,
        fileName,
        objectPath,
      ),
      objectPath,
    },
  ];
}

export function getSupportMessageAttachment(message: SupportMessage): SupportAttachment | null {
  const attachments = getSupportMessageAttachments(message);
  return attachments.length > 0 ? attachments[0] : null;
}

function isImageUrlCandidate(url: string): boolean {
  const normalized = String(url || "").trim();
  if (!normalized) {
    return false;
  }

  const lower = normalized.toLowerCase();
  if (
    lower.includes("/storage/v1/object/public/") ||
    lower.includes("supabase.co/storage/v1/object/public/")
  ) {
    return true;
  }

  // Strip query/hash before extension checks.
  const stripped = lower.split("?")[0].split("#")[0];
  return (
    stripped.endsWith(".jpg") ||
    stripped.endsWith(".jpeg") ||
    stripped.endsWith(".png") ||
    stripped.endsWith(".webp") ||
    stripped.endsWith(".heic") ||
    stripped.endsWith(".heif")
  );
}

function extractImageUrlsFromText(text: string): string[] {
  const raw = String(text || "");
  if (!raw) {
    return [];
  }

  const matches = raw.match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  const deduped = new Set<string>();
  for (const candidate of matches) {
    const url = candidate.trim();
    if (isImageUrlCandidate(url)) {
      deduped.add(url);
    }
  }
  return Array.from(deduped);
}

function getSenderLabel(senderType: SupportMessage["sender_type"]): string {
  if (senderType === "user") {
    return "Customer";
  }
  if (senderType === "admin") {
    return "Admin";
  }
  if (senderType === "support") {
    return "Support";
  }
  return "System";
}

function getSenderAvatar(senderType: SupportMessage["sender_type"]): string {
  if (senderType === "user") {
    return "C";
  }
  if (senderType === "admin") {
    return "A";
  }
  if (senderType === "support") {
    return "S";
  }
  return "SYS";
}

function resolveIsFromCurrentActor(message: SupportMessage, context: SupportRequestContext): boolean {
  if (typeof message.is_from_current_actor === "boolean") {
    return message.is_from_current_actor;
  }

  const matchesCurrentAdminActor = matchesAdminActor(message, context.actorAdminUserId);
  const matchesCurrentUserActor = matchesUserActor(message, context.actorUserId);
  if (matchesCurrentAdminActor || matchesCurrentUserActor) {
    return true;
  }

  if (message.direction === "admin_to_user") {
    return matchesCurrentAdminActor;
  }
  if (message.direction === "admin_to_support") {
    return matchesCurrentAdminActor;
  }
  if (message.direction === "user_to_support") {
    return matchesCurrentUserActor;
  }
  if (message.direction === "support_to_admin" || message.direction === "support_to_user") {
    return false;
  }

  return false;
}

function mapSupportMessage(message: SupportMessage, context: SupportRequestContext): SupportChatMessage {
  const attachments = getSupportMessageAttachments(message);
  const bodyTextRaw = String(message.body || message.message || "");
  const bodyText = sanitizeSupportMessageContent(bodyTextRaw, attachments);
  const attachmentImageUrls = attachments
    .filter((attachment) => attachment.isImage && Boolean(attachment.url))
    .map((attachment) => String(attachment.url || "").trim())
    .filter(Boolean);
  const bodyImageUrls =
    attachmentImageUrls.length === 0 ? extractImageUrlsFromText(bodyText) : [];
  const combinedImageUrls = Array.from(
    new Set<string>([
      ...attachmentImageUrls,
      ...bodyImageUrls,
    ]),
  );
  const senderType = normalizeSenderType(message);
  const statusText = String(message?.status || "").trim().toLowerCase();
  const rawStatus = String(message?.status || "").trim();
  const pushDeliveryStatus = String(message?.pushDeliveryStatus || "").trim();
  const normalizedPushDeliveryStatus = pushDeliveryStatus.toLowerCase();
  const hasDeliveryWarning =
    normalizedPushDeliveryStatus === "unmapped" ||
    normalizedPushDeliveryStatus === "no_devices";
  const mappedStatus =
    senderType === "support" || senderType === "system"
      ? undefined
      : statusText === "failed"
      ? "failed"
      : statusText === "pending"
      ? "sending"
      : "sent";
  const isFromCurrentActor = resolveIsFromCurrentActor(message, context);
  return {
    id: String(message.id || ""),
    content: bodyText,
    senderType,
    senderLabel: getSenderLabel(senderType),
    senderAvatar: getSenderAvatar(senderType),
    isFromCurrentActor,
    direction: message.direction,
    userId: message.user_id || message.sender_user_id || undefined,
    adminUserId: message.admin_user_id || message.sender_admin_user_id || undefined,
    timestamp: new Date(message.created_at || message.createdAt || Date.now()),
    status: mappedStatus,
    rawStatus: rawStatus || undefined,
    pushDeliveryStatus: pushDeliveryStatus || undefined,
    hasDeliveryWarning,
    imageUrl: combinedImageUrls[0],
    imageUrls: combinedImageUrls,
    attachments,
  };
}

function mergeMessages(
  serverMessages: SupportChatMessage[],
  localMessages: SupportChatMessage[],
): SupportChatMessage[] {
  const pending = localMessages.filter((message) => message.status === "sending" || message.status === "failed");
  const existingIds = new Set(serverMessages.map((message) => message.id));
  const merged = [...serverMessages];

  pending.forEach((message) => {
    if (!existingIds.has(message.id)) {
      merged.push(message);
    }
  });

  const deduped = new Map<string, SupportChatMessage>();
  merged.forEach((message) => {
    const key = String(message.id || "").trim();
    if (!key) {
      return;
    }
    const existing = deduped.get(key);
    if (!existing || message.timestamp.getTime() >= existing.timestamp.getTime()) {
      deduped.set(key, message);
    }
  });

  return Array.from(deduped.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

type SupportErrorKind =
  | "auth"
  | "forbidden"
  | "target_required"
  | "thread_unavailable"
  | "metadata_incomplete"
  | "account_inactive"
  | "other";

function classifySupportError(error: string): SupportErrorKind {
  const text = String(error || "").toLowerCase();
  if (
    text.includes("invalid token") ||
    text.includes("token expired") ||
    text.includes("expired token") ||
    text.includes("status 401") ||
    text.includes("401 unauthorized") ||
    text === "unauthorized"
  ) {
    return "auth";
  }
  if (
    text.includes("account is deleted") ||
    text.includes("account deleted") ||
    text.includes("inactive account") ||
    text.includes("account is inactive")
  ) {
    return "account_inactive";
  }
  if (text.includes("status 403") || text.includes("forbidden")) {
    return "forbidden";
  }
  if (
    text.includes("status 422") &&
    text.includes("userid is required")
  ) {
    return "target_required";
  }
  if (
    text.includes("userid is required") ||
    text.includes("select a conversation/user before sending")
  ) {
    return "target_required";
  }
  if (
    text.includes("target user not found") ||
    text.includes("target thread not found") ||
    text.includes("thread unavailable") ||
    text.includes("status 404")
  ) {
    return "thread_unavailable";
  }
  if (text.includes("conversationid") || text.includes("conversation id")) {
    return "metadata_incomplete";
  }
  return "other";
}

export function useSupportPageModel(): SupportPageModel {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollAbortControllerRef = useRef<AbortController | null>(null);
  const pollInFlightRef = useRef(false);
  const pollBackoffIndexRef = useRef(0);
  const pollPausedRef = useRef(false);
  const pollCycleRef = useRef(0);
  const fastPollUntilRef = useRef(0);
  const mountedRef = useRef(true);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);

  const hasMessages = messages.length > 0;

  const scrollMessagesToBottom = () => {
    if (typeof window === "undefined") {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      return;
    }
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
  };

  useEffect(() => {
    scrollMessagesToBottom();
  }, [messages]);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
  }, [inputValue]);

  type SupportSyncResult = "success" | "unauthorized" | "error" | "aborted" | "skipped";

  const clearPollTimer = () => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const abortPollRequest = () => {
    if (pollAbortControllerRef.current) {
      pollAbortControllerRef.current.abort();
      pollAbortControllerRef.current = null;
    }
  };

  const stopPolling = (abortInFlight = true) => {
    pollCycleRef.current += 1;
    clearPollTimer();
    if (abortInFlight) {
      abortPollRequest();
    }
  };

  const getNextPollInterval = () => {
    const now = Date.now();
    if (now < fastPollUntilRef.current) {
      return SUPPORT_POLL_FAST_INTERVAL_MS;
    }
    if (document.visibilityState !== "visible") {
      return SUPPORT_POLL_INACTIVE_INTERVAL_MS;
    }
    return SUPPORT_POLL_INTERVAL_MS;
  };

  const getBackoffDelay = () => {
    const index = Math.min(pollBackoffIndexRef.current, SUPPORT_POLL_BACKOFF_MS.length - 1);
    const delay = SUPPORT_POLL_BACKOFF_MS[index];
    pollBackoffIndexRef.current = Math.min(index + 1, SUPPORT_POLL_BACKOFF_MS.length - 1);
    return delay;
  };

  const syncConversation = async (showErrors = false, force = false): Promise<SupportSyncResult> => {
    if (!mountedRef.current) {
      return "aborted";
    }

    if (force && pollInFlightRef.current) {
      abortPollRequest();
    } else if (pollInFlightRef.current) {
      return "skipped";
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (controller) {
      pollAbortControllerRef.current = controller;
    }
    pollInFlightRef.current = true;

    try {
      const response = await loadSupportConversation({
        signal: controller?.signal,
      });

      if (controller?.signal.aborted) {
        return "aborted";
      }

      if (!response.success) {
        const errorKind = classifySupportError(response.error || "");
        if (errorKind === "auth") {
          if (mountedRef.current) {
            setRequiresAuth(true);
            setShowAuthModal(true);
            setMessages([]);
          }
          return "unauthorized";
        }

        if (showErrors && mountedRef.current) {
          if (errorKind === "forbidden") {
            toast.error("This account cannot access support chat right now.");
          } else if (errorKind === "account_inactive") {
            toast.error("This account is inactive or deleted and cannot use support chat.");
          } else if (errorKind === "thread_unavailable") {
            toast.error("This support thread is unavailable.");
          } else if (errorKind === "metadata_incomplete") {
            toast.error("Support thread data is incomplete. Backend must return conversationId.");
          } else {
            toast.error(response.error || "Unable to load support conversation.");
          }
        }
        return "error";
      }

      const requestContext = resolveSupportRequestContext();
      const serverMessages = (response.data?.messages || []).map((message) =>
        mapSupportMessage(message, requestContext),
      );
      const directionCounts = serverMessages.reduce<Record<string, number>>((acc, message) => {
        const direction = message.direction || "unknown";
        acc[direction] = (acc[direction] || 0) + 1;
        return acc;
      }, {});
      const rawStatusCounts = serverMessages.reduce<Record<string, number>>((acc, message) => {
        const key = String(message.rawStatus || "unknown").toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const pushStatusCounts = serverMessages.reduce<Record<string, number>>((acc, message) => {
        const key = String(message.pushDeliveryStatus || "none").toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      console.info("[support] filter-check", {
        note: "No direction/status filtering is applied; all fetched messages are rendered.",
        totalFetched: serverMessages.length,
        droppedCount: 0,
        directionCounts,
        rawStatusCounts,
        pushStatusCounts,
      });
      if (mountedRef.current) {
        setMessages((current) => mergeMessages(serverMessages, current));
      }
      pollBackoffIndexRef.current = 0;
      return "success";
    } finally {
      pollInFlightRef.current = false;
      if (pollAbortControllerRef.current === controller) {
        pollAbortControllerRef.current = null;
      }
    }
  };

  const scheduleNextPoll = (delayMs?: number, cycleId: number = pollCycleRef.current) => {
    clearPollTimer();
    if (!mountedRef.current || pollPausedRef.current || cycleId !== pollCycleRef.current) {
      return;
    }
    const delay = typeof delayMs === "number" ? Math.max(0, delayMs) : getNextPollInterval();
    pollTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current || pollPausedRef.current || cycleId !== pollCycleRef.current) {
        return;
      }
      void (async () => {
        if (cycleId !== pollCycleRef.current) {
          return;
        }
        if (!isAuthenticated()) {
          setRequiresAuth(true);
          return;
        }

        const result = await syncConversation(false);
        if (result === "unauthorized") {
          stopPolling(true);
          return;
        }

        if (result === "error") {
          scheduleNextPoll(getBackoffDelay(), cycleId);
          return;
        }

        if (result === "success") {
          pollBackoffIndexRef.current = 0;
        }
        scheduleNextPoll(undefined, cycleId);
      })();
    }, delay);
  };

  const startPolling = (delayMs?: number, forceRefresh = false) => {
    pollCycleRef.current += 1;
    const cycleId = pollCycleRef.current;
    pollPausedRef.current = false;
    clearPollTimer();
    if (forceRefresh) {
      abortPollRequest();
      void (async () => {
        const result = await syncConversation(false, true);
        if (cycleId !== pollCycleRef.current) {
          return;
        }
        if (result === "unauthorized") {
          stopPolling(true);
          return;
        }
        if (result === "error") {
          scheduleNextPoll(getBackoffDelay(), cycleId);
          return;
        }
        if (result === "success") {
          pollBackoffIndexRef.current = 0;
        }
        scheduleNextPoll(delayMs, cycleId);
      })();
      return;
    }
    scheduleNextPoll(delayMs, cycleId);
  };

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    const loadInitialConversation = async () => {
      setIsLoading(true);

      if (!isAuthenticated()) {
        if (!cancelled) {
          setRequiresAuth(true);
          setShowAuthModal(true);
          setIsLoading(false);
        }
        return;
      }

      const result = await syncConversation(true, true);
      if (!cancelled && result === "success") {
        setRequiresAuth(false);
      }
      if (!cancelled && result === "unauthorized") {
        setRequiresAuth(true);
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    };

    void loadInitialConversation();

    const handleAuthChange = () => {
      if (!isAuthenticated()) {
        setRequiresAuth(true);
        stopPolling(true);
        return;
      }

      setRequiresAuth(false);
      setShowAuthModal(false);
      startPolling(0, true);
    };

    const removeAuthListener = addAuthSessionChangeListener(handleAuthChange);
    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        pollPausedRef.current = true;
        stopPolling(true);
        return;
      }
      if (!isAuthenticated()) {
        setRequiresAuth(true);
        return;
      }
      startPolling(0, true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      removeAuthListener();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopPolling(true);
    };
  }, []);

  const supportTyping = useMemo(() => {
    if (!hasMessages || isSending) {
      return false;
    }

    const lastMessage = messages[messages.length - 1];
    return Boolean(!lastMessage?.isFromCurrentActor && lastMessage?.status === "sending");
  }, [hasMessages, isSending, messages]);

  const handleSendMessage = async (rawBody: string, retryId?: string) => {
    const body = String(rawBody || "").trim();
    if ((!body && selectedImages.length === 0) || isSending || requiresAuth) {
      return;
    }

    const pendingImages = [...selectedImages];
    const pendingPreviewUrl = imagePreviewUrl;
    const optimisticId = retryId || `local-${Date.now()}`;
    const context = resolveSupportRequestContext();
    const optimisticSenderType: SupportMessage["sender_type"] =
      context.requestMode === "admin_thread" || context.requestMode === "admin_self"
        ? "admin"
        : "user";
    const optimisticDirection: SupportChatMessage["direction"] =
      context.requestMode === "admin_thread"
        ? "admin_to_user"
        : context.requestMode === "admin_self"
        ? "admin_to_support"
        : "user_to_support";
    const optimisticMessage: SupportChatMessage = {
      id: optimisticId,
      content: body,
      senderType: optimisticSenderType,
      senderLabel: getSenderLabel(optimisticSenderType),
      senderAvatar: getSenderAvatar(optimisticSenderType),
      isFromCurrentActor: true,
      direction: optimisticDirection,
      userId: context.actorUserId || undefined,
      adminUserId: context.actorAdminUserId || undefined,
      timestamp: new Date(),
      status: "sending",
      imageUrl: pendingPreviewUrl || undefined,
      imageUrls: pendingPreviewUrl ? [pendingPreviewUrl] : undefined,
    };

    setMessages((current) => {
      const withoutRetried = retryId ? current.filter((message) => message.id !== retryId) : current;
      return [...withoutRetried, optimisticMessage];
    });
    setInputValue("");
    setSelectedImages([]);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsSending(true);

    const response = await sendSupportMessage(body, pendingImages);
    if (!response.success) {
      const errorKind = classifySupportError(response.error || "");
      if (errorKind === "auth") {
        setRequiresAuth(true);
        setShowAuthModal(true);
      }
      if (!retryId && pendingImages.length > 0) {
        setSelectedImages(pendingImages);
        setImagePreviewUrl(pendingPreviewUrl);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
      setMessages((current) =>
        current.map((message) =>
          message.id === optimisticId ? { ...message, status: "failed" } : message,
        ),
      );
      setIsSending(false);
      if (errorKind === "target_required") {
        toast.error("Select a conversation/user before sending.");
      } else if (errorKind === "thread_unavailable") {
        toast.error("This support thread is unavailable.");
        void syncConversation(false, true);
      } else if (errorKind === "metadata_incomplete") {
        toast.error("Support thread data is incomplete. Backend must return conversationId.");
      } else if (errorKind === "forbidden") {
        toast.error("This account cannot send support messages right now.");
      } else if (errorKind === "account_inactive") {
        toast.error("This account is inactive or deleted and cannot use support chat.");
      } else {
        toast.error(response.error || "Unable to send message.");
      }
      return;
    }

    setMessages((current) => current.filter((message) => message.id !== optimisticId));

    const syncResult = await syncConversation(false, true);
    if (syncResult === "unauthorized") {
      setRequiresAuth(true);
      setShowAuthModal(true);
    } else if (syncResult !== "success") {
      setMessages((current) => [
        ...current,
        {
          ...optimisticMessage,
          status: "sent",
        },
      ]);
    }

    fastPollUntilRef.current = Date.now() + SUPPORT_POLL_FAST_WINDOW_MS;
    startPolling(SUPPORT_POLL_FAST_INTERVAL_MS);
    setIsSending(false);
  };

  const handleQuickAction = (action: string) => {
    void handleSendMessage(action);
  };

  const handleRetry = (message: SupportChatMessage) => {
    if ((message.imageUrls && message.imageUrls.length > 0) || message.imageUrl) {
      toast.error("Please attach the image again before retrying.");
      return;
    }

    void handleSendMessage(message.content, message.id);
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    const invalidFile = files.find((file) => !isAllowedSupportImage(file));
    if (invalidFile) {
      toast.error(`${invalidFile.name}: unsupported image type.`);
      return;
    }

    const tooLarge = files.find((file) => file.size > DEFAULT_SUPPORT_MAX_FILE_BYTES);
    if (tooLarge) {
      toast.error(`${tooLarge.name}: image must be smaller than 10MB.`);
      return;
    }

    const next = [...selectedImages, ...files].slice(0, MAX_SUPPORT_ATTACHMENTS);
    if (next.length < selectedImages.length + files.length) {
      toast.error(`You can attach up to ${MAX_SUPPORT_ATTACHMENTS} images.`);
    } else if (files.length > 1) {
      toast.success(`${files.length} images attached.`);
    }

    setSelectedImages(next);
    const first = next[0] || null;
    if (!first) {
      setImagePreviewUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(first);
    event.target.value = "";
  };

  const handleRemoveImage = () => {
    setSelectedImages([]);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage(inputValue);
    }
  };

  const handleAuthSuccess = async () => {
    setRequiresAuth(false);
    setShowAuthModal(false);
    setIsLoading(true);
    const result = await syncConversation(true, true);
    setIsLoading(false);

    if (result === "success") {
      toast.success("Authentication successful");
      startPolling();
    }
  };

  return {
    messages,
    inputValue,
    imagePreviewUrl,
    isLoading,
    isSending,
    showAuthModal,
    requiresAuth,
    hasMessages,
    supportTyping,
    messagesEndRef,
    textareaRef,
    fileInputRef,
    scrollMessagesToBottom,
    setInputValue,
    navigateBack: () => navigate(-1),
    openAuthModal: () => setShowAuthModal(true),
    closeAuthModal: () => setShowAuthModal(false),
    handleAuthSuccess,
    handleSendCurrentMessage: () => handleSendMessage(inputValue),
    handleQuickAction,
    handleRetry,
    handleAttachmentClick,
    handleFileSelect,
    handleRemoveImage,
    handleInputKeyDown,
  };
}
