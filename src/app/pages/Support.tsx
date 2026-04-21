import { useState } from "react";
import { ChevronLeft, ExternalLink, Loader2, MessageCircle, Paperclip, Send, X } from "lucide-react";
import { AuthModal } from "../components/auth/AuthModal";
import { Button } from "../components/ui/button";
import { formatSupportTime } from "../utils/view-formatters";
import {
  type SupportAttachment,
  type SupportChatMessage,
  useSupportPageModel,
} from "../wiring/support-page-service";

const QUICK_ACTIONS = ["Purchase problem", "Activation issue", "Refund question", "General support"];

export function Support() {
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const {
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
    navigateBack,
    openAuthModal,
    closeAuthModal,
    handleAuthSuccess,
    handleSendCurrentMessage,
    handleQuickAction,
    handleRetry,
    handleAttachmentClick,
    handleFileSelect,
    handleRemoveImage,
    handleInputKeyDown,
  } = useSupportPageModel();

  const markImageAsFailed = (url?: string) => {
    const normalized = String(url || "").trim();
    if (!normalized) {
      return;
    }
    setFailedImageUrls((current) => {
      if (current[normalized]) {
        return current;
      }
      return { ...current, [normalized]: true };
    });
  };

  const resolveRenderableAttachmentUrl = (attachment: SupportAttachment): string => {
    const candidates = [
      String(attachment.url || "").trim(),
      ...((attachment.urlCandidates || []).map((value) => String(value || "").trim())),
    ].filter(Boolean);
    return candidates.find((candidate) => !failedImageUrls[candidate]) || "";
  };

  const handleMessageImageLoad = () => {
    scrollMessagesToBottom();
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f8f9fc] dark:bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-white dark:bg-card px-4 pb-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none border-b dark:border-border" style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 1rem)' }}>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-muted transition-colors hover:bg-gray-200 dark:hover:bg-accent active:bg-gray-300"
          onClick={navigateBack}
          type="button"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-semibold tracking-tight text-gray-900 dark:text-foreground">Support</h1>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            <p className="text-[12px] text-gray-500 dark:text-muted-foreground">Online · Typically replies instantly</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : requiresAuth ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/25">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-foreground">Log in to chat with support</h2>
              <p className="text-sm text-muted-foreground">
                Sign in to access your private support conversation and keep your messages linked to your account.
              </p>
            </div>
            <Button className="h-12 rounded-2xl px-8 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 text-white" onClick={openAuthModal} type="button">
              Log In to Continue
            </Button>
          </div>
        ) : !hasMessages ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/25">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-foreground">How can we help?</h2>
              <p className="text-sm text-muted-foreground">
                We&apos;re here to help with your eSIM plans, activation, or any questions about your travel connectivity.
              </p>
            </div>

            <div className="w-full space-y-3">
              <p className="text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider">Quick actions</p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    className="rounded-2xl bg-white dark:bg-card border border-gray-200 dark:border-border hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-5 py-2.5 text-sm transition-all shadow-sm hover:shadow-md font-medium text-gray-700 dark:text-foreground hover:text-blue-600 dark:hover:text-blue-400"
                    onClick={() => handleQuickAction(action)}
                    type="button"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-3 pb-4">
            {messages.map((message: SupportChatMessage, index) => {
              const previous = index > 0 ? messages[index - 1] : null;
              const showTimestamp =
                !previous ||
                previous.isFromCurrentActor !== message.isFromCurrentActor ||
                previous.senderType !== message.senderType ||
                message.timestamp.getTime() - previous.timestamp.getTime() > 300000;
              const outgoing = message.isFromCurrentActor;

              return (
                <div className="space-y-1" key={message.id}>
                  {showTimestamp ? (
                    <div className="text-center py-1">
                      <span className="text-[11px] text-gray-400 font-medium">{formatSupportTime(message.timestamp)}</span>
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
                          outgoing ? "justify-end text-white/90" : "justify-start text-gray-500 dark:text-muted-foreground",
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
                      {(message.attachments || []).map((attachment: SupportAttachment, attachmentIndex) => {
                        const attachmentUrl = resolveRenderableAttachmentUrl(attachment);
                        const canRenderImage =
                          attachment.isImage && Boolean(attachmentUrl) && !failedImageUrls[attachmentUrl];
                        return canRenderImage ? (
                          <button
                            key={`${message.id}-image-attachment-${attachmentIndex}`}
                            type="button"
                            className="mb-2 block w-full"
                            onClick={() => setFullscreenImageUrl(attachmentUrl)}
                            aria-label="Open image"
                          >
                            <img
                              src={attachmentUrl}
                              alt={attachment.name || "Attached image"}
                              className="max-h-60 w-full rounded-xl object-cover"
                              onLoad={handleMessageImageLoad}
                              onError={() => markImageAsFailed(attachmentUrl)}
                            />
                          </button>
                        ) : (
                          <div
                            key={`${message.id}-file-attachment-${attachmentIndex}`}
                            className={[
                              "mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
                              outgoing
                                ? "border-white/30 bg-white/10 text-white"
                                : "border-gray-200 dark:border-border bg-gray-50 dark:bg-muted text-gray-700 dark:text-foreground",
                            ].join(" ")}
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="max-w-[180px] truncate">
                              {attachment.name || "Attachment"}
                            </span>
                            {resolveRenderableAttachmentUrl(attachment) ? (
                              <a
                                href={resolveRenderableAttachmentUrl(attachment)}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-auto inline-flex items-center gap-1 underline underline-offset-2"
                              >
                                <span>Open</span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              </a>
                            ) : (
                              <span className="ml-auto opacity-70">No link</span>
                            )}
                          </div>
                        );
                      })}
                      {(!message.attachments || message.attachments.length === 0
                        ? message.imageUrls && message.imageUrls.length > 0
                          ? message.imageUrls
                          : message.imageUrl
                          ? [message.imageUrl]
                          : []
                        : []
                      )
                        .filter((imageUrl) => !failedImageUrls[String(imageUrl || "").trim()])
                        .map((imageUrl, imageIndex) => (
                        <button
                          key={`${message.id}-legacy-image-${imageIndex}`}
                          type="button"
                          className="mb-2 block w-full"
                          onClick={() => setFullscreenImageUrl(imageUrl)}
                          aria-label="Open image"
                        >
                          <img
                            src={imageUrl}
                            alt="Attached"
                            className="max-h-60 w-full rounded-xl object-cover"
                            onLoad={handleMessageImageLoad}
                            onError={() => markImageAsFailed(imageUrl)}
                          />
                        </button>
                        ))}
                      {message.content ? (
                        <div className="flex items-end gap-1.5">
                          <p className="whitespace-pre-wrap text-[14px] leading-relaxed flex-1">{message.content}</p>
                          {outgoing && message.status === "sending" ? (
                            <Loader2 className="h-3 w-3 animate-spin text-white/50 shrink-0 mb-0.5" />
                          ) : null}
                          {outgoing && message.status === "sent" ? (
                            <svg className="h-3 w-3 text-white/50 shrink-0 mb-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
                            </svg>
                          ) : null}
                          {outgoing && message.status === "failed" ? (
                            <button className="text-[10px] font-medium text-white/70 underline shrink-0 mb-0.5" onClick={() => handleRetry(message)} type="button">Retry</button>
                          ) : null}
                        </div>
                      ) : null}
                      {/* Status for image-only messages */}
                      {!message.content && outgoing && message.status ? (
                        <div className="mt-1 flex justify-end">
                          {message.status === "sending" ? <Loader2 className="h-3 w-3 animate-spin text-white/50" /> : null}
                          {message.status === "sent" ? (
                            <svg className="h-3 w-3 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                              <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
                            </svg>
                          ) : null}
                          {message.status === "failed" ? (
                            <button className="text-[10px] font-medium text-white/70 underline" onClick={() => handleRetry(message)} type="button">Retry</button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {supportTyping ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white dark:bg-card px-4 py-3 shadow-sm border border-gray-100 dark:border-border">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#9ca3af]" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#9ca3af]" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#9ca3af]" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="safe-area-bottom sticky bottom-0 z-10 border-t border-gray-100 dark:border-border bg-white/95 dark:bg-card/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-2xl">
          {imagePreviewUrl ? (
            <div className="mb-2 flex items-start gap-2">
              <div className="relative">
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-900"
                  type="button"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <button
              onClick={handleAttachmentClick}
              disabled={isSending || requiresAuth}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 dark:bg-muted transition-colors hover:bg-gray-200 dark:hover:bg-accent disabled:opacity-50"
              type="button"
              aria-label="Attach image"
            >
              <Paperclip className="h-5 w-5 text-gray-500 dark:text-muted-foreground" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                className="max-h-32 w-full resize-none rounded-2xl border border-gray-200 dark:border-border bg-gray-50 dark:bg-muted px-4 py-3 text-[16px] dark:text-foreground transition-all focus:border-blue-400 focus:bg-white dark:focus:bg-card focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                disabled={isSending || requiresAuth}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Type a message..."
                rows={1}
                value={inputValue}
              />
            </div>
            <Button
              className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-500/20 disabled:opacity-50"
              disabled={(!inputValue.trim() && !imagePreviewUrl) || isSending || requiresAuth}
              onClick={() => void handleSendCurrentMessage()}
              size="icon"
              type="button"
            >
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {fullscreenImageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setFullscreenImageUrl(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
              setFullscreenImageUrl(null);
            }
          }}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            aria-label="Close image"
            onClick={(event) => {
              event.stopPropagation();
              setFullscreenImageUrl(null);
            }}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={fullscreenImageUrl}
            alt="Full screen attachment"
            className="max-h-full max-w-full rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}

      <AuthModal
        isOpen={showAuthModal}
        initialMode="login"
        onClose={closeAuthModal}
        onSuccess={() => void handleAuthSuccess()}
      />
    </div>
  );
}
