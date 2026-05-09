import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Loader2, MessageCircle, Paperclip, Send, X } from "lucide-react";
import { AuthModal } from "../components/auth/AuthModal";
import { Button } from "../components/ui/button";
import { SupportMessageBubble } from "../components/SupportMessageBubble";
import { SupportSkeleton } from "../components/SupportSkeleton";
import {
  type SupportAttachment,
  type SupportChatMessage,
  useSupportPageModel,
} from "../wiring/support-page-service";

const QUICK_ACTION_KEYS = [
  "support.quick_action.purchase",
  "support.quick_action.activation",
  "support.quick_action.refund",
  "support.quick_action.general",
] as const;

export function Support() {
  const { t, i18n } = useTranslation();
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const isRtl = i18n.language === "ar" || i18n.language === "ku";
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

  // Debounce per-image-load scroll calls into a single rAF pass. Without
  // this, three images loading near-simultaneously each fired their own
  // scrollIntoView → visible jank.
  const pendingScrollRafRef = useRef<number | null>(null);
  const handleMessageImageLoad = useCallback(() => {
    if (pendingScrollRafRef.current !== null) {
      return;
    }
    pendingScrollRafRef.current = window.requestAnimationFrame(() => {
      pendingScrollRafRef.current = null;
      scrollMessagesToBottom();
    });
  }, [scrollMessagesToBottom]);

  const markImageAsFailed = useCallback((url: string) => {
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
  }, []);

  const resolveAttachmentUrl = useCallback(
    (attachment: SupportAttachment): string => {
      const candidates = [
        String(attachment.url || "").trim(),
        ...((attachment.urlCandidates || []).map((value) => String(value || "").trim())),
      ].filter(Boolean);
      return candidates.find((candidate) => !failedImageUrls[candidate]) || "";
    },
    [failedImageUrls],
  );

  const i18nLocale = i18n.language;

  const renderedMessages = useMemo(
    () =>
      messages.map((message: SupportChatMessage, index) => {
        const previous = index > 0 ? messages[index - 1] : null;
        const showTimestamp =
          !previous ||
          previous.isFromCurrentActor !== message.isFromCurrentActor ||
          previous.senderType !== message.senderType ||
          message.timestamp.getTime() - previous.timestamp.getTime() > 300000;
        return (
          <SupportMessageBubble
            key={message.id}
            message={message}
            showTimestamp={showTimestamp}
            failedImageUrls={failedImageUrls}
            resolveAttachmentUrl={resolveAttachmentUrl}
            onMarkImageFailed={markImageAsFailed}
            onOpenFullscreen={setFullscreenImageUrl}
            onImageLoaded={handleMessageImageLoad}
            onRetry={handleRetry}
            i18nLocale={i18nLocale}
            isRtl={isRtl}
          />
        );
      }),
    [
      messages,
      failedImageUrls,
      resolveAttachmentUrl,
      markImageAsFailed,
      handleMessageImageLoad,
      handleRetry,
      i18nLocale,
      isRtl,
    ],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f8f9fc] dark:bg-background">
      <header
        className="sticky top-0 z-10 flex items-center gap-3 bg-white dark:bg-card px-4 pb-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none border-b dark:border-border rtl:flex-row-reverse"
        style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 1rem)' }}
      >
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-muted transition-colors hover:bg-gray-200 dark:hover:bg-accent active:bg-gray-300"
          onClick={navigateBack}
          type="button"
          aria-label={t("support.go_back")}
        >
          <ChevronLeft className={`h-5 w-5 text-gray-700 dark:text-foreground ${isRtl ? "rotate-180" : ""}`} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-semibold tracking-tight text-gray-900 dark:text-foreground">
            {t("Support")}
          </h1>
          <div className="flex items-center gap-1.5 rtl:flex-row-reverse">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            <p className="text-[12px] text-gray-500 dark:text-muted-foreground">
              {t("support.online_status")}
            </p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {isLoading ? (
          <SupportSkeleton />
        ) : requiresAuth ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/25">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-foreground">
                {t("support.auth_required_title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("support.auth_required_body")}</p>
            </div>
            <Button
              className="h-12 rounded-2xl px-8 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 text-white"
              onClick={openAuthModal}
              type="button"
            >
              {t("support.login_to_continue")}
            </Button>
          </div>
        ) : !hasMessages ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/25">
                <MessageCircle className="h-10 w-10 text-white" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-foreground">
                {t("support.empty_title")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("support.empty_body")}</p>
            </div>

            <div className="w-full space-y-3">
              <p className="text-xs font-medium text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                {t("support.quick_actions")}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_ACTION_KEYS.map((actionKey) => {
                  const label = t(actionKey);
                  return (
                    <button
                      key={actionKey}
                      className="rounded-2xl bg-white dark:bg-card border border-gray-200 dark:border-border hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-5 py-2.5 text-sm transition-all shadow-sm hover:shadow-md font-medium text-gray-700 dark:text-foreground hover:text-blue-600 dark:hover:text-blue-400"
                      onClick={() => handleQuickAction(label)}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-3 pb-4">
            {renderedMessages}

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
                  alt={t("support.preview_alt")}
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <button
                  onClick={handleRemoveImage}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-900"
                  type="button"
                  aria-label={t("support.remove_image")}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex items-end gap-2 rtl:flex-row-reverse">
            <button
              onClick={handleAttachmentClick}
              disabled={isSending || requiresAuth}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 dark:bg-muted transition-colors hover:bg-gray-200 dark:hover:bg-accent disabled:opacity-50"
              type="button"
              aria-label={t("support.attach_image")}
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
                placeholder={t("support.input_placeholder")}
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
            aria-label={t("support.close_image")}
            onClick={(event) => {
              event.stopPropagation();
              setFullscreenImageUrl(null);
            }}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={fullscreenImageUrl}
            alt={t("support.fullscreen_alt")}
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
        redirectToHomeOnSuccess={false}
      />
    </div>
  );
}