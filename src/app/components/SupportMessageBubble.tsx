import { memo, useMemo } from "react";
import { ExternalLink, Loader2, Paperclip } from "lucide-react";
import { formatSupportTime } from "../utils/view-formatters";
import type {
  SupportAttachment,
  SupportChatMessage,
} from "../wiring/support-page-service";

// Top-level cache: Intl.DateTimeFormat is expensive to construct, and the
// previous implementation built a new formatter per message per render. This
// memoizes by (timestamp ms + locale) so the same message renders without
// rebuilding. Keys are bounded; we trim if it grows unreasonably.
const __formattedTimeCache = new Map<string, string>();

function getFormattedSupportTime(timestamp: Date, locale: string): string {
  const key = `${timestamp.getTime()}|${locale}`;
  const cached = __formattedTimeCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const value = formatSupportTime(timestamp);
  if (__formattedTimeCache.size > 256) {
    __formattedTimeCache.clear();
  }
  __formattedTimeCache.set(key, value);
  return value;
}

interface SupportMessageBubbleProps {
  message: SupportChatMessage;
  showTimestamp: boolean;
  failedImageUrls: Record<string, true>;
  resolveAttachmentUrl: (attachment: SupportAttachment) => string;
  onMarkImageFailed: (url: string) => void;
  onOpenFullscreen: (url: string) => void;
  onImageLoaded: () => void;
  onRetry: (message: SupportChatMessage) => void;
  i18nLocale: string;
  isRtl: boolean;
}

function SupportMessageBubbleInner({
  message,
  showTimestamp,
  failedImageUrls,
  resolveAttachmentUrl,
  onMarkImageFailed,
  onOpenFullscreen,
  onImageLoaded,
  onRetry,
  i18nLocale,
  isRtl,
}: SupportMessageBubbleProps) {
  const outgoing = message.isFromCurrentActor;
  const formattedTime = useMemo(
    () => getFormattedSupportTime(message.timestamp, i18nLocale),
    [message.timestamp, i18nLocale],
  );

  const attachments = message.attachments || [];
  const legacyImageUrls =
    !attachments.length
      ? message.imageUrls && message.imageUrls.length > 0
        ? message.imageUrls
        : message.imageUrl
        ? [message.imageUrl]
        : []
      : [];

  return (
    <div className="space-y-1">
      {showTimestamp ? (
        <div className="text-center py-1">
          <span className="text-[11px] text-gray-400 font-medium">{formattedTime}</span>
        </div>
      ) : null}

      <div className={outgoing ? "flex justify-end" : "flex justify-start"}>
        <div
          className={[
            "max-w-[84%] rounded-2xl px-4 py-3 shadow-sm",
            outgoing
              ? "rounded-br-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
              : "rounded-bl-md bg-white dark:bg-card text-gray-800 dark:text-foreground border border-gray-100 dark:border-border",
          ].join(" ")}
        >
          <div
            className={[
              "mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-wide",
              outgoing
                ? "justify-end text-white/90 rtl:flex-row-reverse"
                : "justify-start text-gray-500 dark:text-muted-foreground rtl:flex-row-reverse",
            ].join(" ")}
          >
            {!outgoing ? (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 dark:border-border bg-gray-100 dark:bg-muted text-[10px] text-gray-700 dark:text-foreground">
                {message.senderAvatar}
              </span>
            ) : null}
            <span>{message.senderLabel}</span>
            {outgoing ? (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/35 bg-white/20 text-[10px] text-white">
                {message.senderAvatar}
              </span>
            ) : null}
          </div>

          {attachments.map((attachment, attachmentIndex) => {
            const attachmentUrl = resolveAttachmentUrl(attachment);
            const canRenderImage =
              attachment.isImage && Boolean(attachmentUrl) && !failedImageUrls[attachmentUrl];
            return canRenderImage ? (
              <button
                key={`${message.id}-image-${attachmentIndex}`}
                type="button"
                className="mb-2 block w-full"
                onClick={() => onOpenFullscreen(attachmentUrl)}
                aria-label="Open image"
              >
                {/* aspect-[4/3] reserves height before the image loads, so
                    the bubble doesn't reflow once the network arrives. */}
                <div className="relative w-full overflow-hidden rounded-xl aspect-[4/3] bg-black/5 dark:bg-white/5">
                  <img
                    src={attachmentUrl}
                    alt={attachment.name || "Attached image"}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    onLoad={onImageLoaded}
                    onError={() => onMarkImageFailed(attachmentUrl)}
                  />
                </div>
              </button>
            ) : (
              <div
                key={`${message.id}-file-${attachmentIndex}`}
                className={[
                  "mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
                  outgoing
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-gray-200 dark:border-border bg-gray-50 dark:bg-muted text-gray-700 dark:text-foreground",
                  isRtl ? "flex-row-reverse" : "",
                ].join(" ")}
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[180px] truncate">
                  {attachment.name || "Attachment"}
                </span>
                {attachmentUrl ? (
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={[
                      "inline-flex items-center gap-1 underline underline-offset-2",
                      isRtl ? "mr-auto" : "ml-auto",
                    ].join(" ")}
                  >
                    <span>Open</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className={isRtl ? "mr-auto opacity-70" : "ml-auto opacity-70"}>
                    No link
                  </span>
                )}
              </div>
            );
          })}

          {legacyImageUrls
            .filter((imageUrl) => !failedImageUrls[String(imageUrl || "").trim()])
            .map((imageUrl, imageIndex) => (
              <button
                key={`${message.id}-legacy-image-${imageIndex}`}
                type="button"
                className="mb-2 block w-full"
                onClick={() => onOpenFullscreen(imageUrl)}
                aria-label="Open image"
              >
                <div className="relative w-full overflow-hidden rounded-xl aspect-[4/3] bg-black/5 dark:bg-white/5">
                  <img
                    src={imageUrl}
                    alt="Attached"
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    onLoad={onImageLoaded}
                    onError={() => onMarkImageFailed(imageUrl)}
                  />
                </div>
              </button>
            ))}

          {message.content ? (
            <div className="flex items-end gap-1.5 rtl:flex-row-reverse">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed flex-1">
                {message.content}
              </p>
              {outgoing && message.status === "sending" ? (
                <Loader2 className="h-3 w-3 animate-spin text-white/50 shrink-0 mb-0.5" />
              ) : null}
              {outgoing && message.status === "sent" ? (
                <svg
                  className="h-3 w-3 text-white/50 shrink-0 mb-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    clipRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    fillRule="evenodd"
                  />
                </svg>
              ) : null}
              {outgoing && message.status === "failed" ? (
                <button
                  className="text-[10px] font-medium text-white/70 underline shrink-0 mb-0.5"
                  onClick={() => onRetry(message)}
                  type="button"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}

          {!message.content && outgoing && message.status ? (
            <div className="mt-1 flex justify-end">
              {message.status === "sending" ? (
                <Loader2 className="h-3 w-3 animate-spin text-white/50" />
              ) : null}
              {message.status === "sent" ? (
                <svg
                  className="h-3 w-3 text-white/50"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    clipRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    fillRule="evenodd"
                  />
                </svg>
              ) : null}
              {message.status === "failed" ? (
                <button
                  className="text-[10px] font-medium text-white/70 underline"
                  onClick={() => onRetry(message)}
                  type="button"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Custom equality: only re-render when the props that actually affect this
// bubble's pixels change. Skip re-renders for unrelated state updates
// elsewhere in the conversation.
function arePropsEqual(prev: SupportMessageBubbleProps, next: SupportMessageBubbleProps): boolean {
  if (
    prev.message.id !== next.message.id ||
    prev.message.status !== next.message.status ||
    prev.message.content !== next.message.content ||
    prev.message.timestamp !== next.message.timestamp ||
    prev.message.senderLabel !== next.message.senderLabel ||
    prev.message.senderAvatar !== next.message.senderAvatar ||
    prev.message.isFromCurrentActor !== next.message.isFromCurrentActor ||
    prev.showTimestamp !== next.showTimestamp ||
    prev.i18nLocale !== next.i18nLocale ||
    prev.isRtl !== next.isRtl
  ) {
    return false;
  }
  // Cheap shape check on attachments.
  const prevAttachments = prev.message.attachments || [];
  const nextAttachments = next.message.attachments || [];
  if (prevAttachments.length !== nextAttachments.length) {
    return false;
  }
  for (let i = 0; i < prevAttachments.length; i += 1) {
    if (
      prevAttachments[i].url !== nextAttachments[i].url ||
      prevAttachments[i].name !== nextAttachments[i].name ||
      prevAttachments[i].isImage !== nextAttachments[i].isImage ||
      prevAttachments[i].objectPath !== nextAttachments[i].objectPath
    ) {
      return false;
    }
  }
  // failedImageUrls is shared across all bubbles; only re-render when the
  // referenced URLs flip into / out of the failed set. Compare by every URL
  // we reference.
  for (const att of nextAttachments) {
    const url = String(att.url || "").trim();
    if (url && Boolean(prev.failedImageUrls[url]) !== Boolean(next.failedImageUrls[url])) {
      return false;
    }
  }
  return true;
}

export const SupportMessageBubble = memo(SupportMessageBubbleInner, arePropsEqual);