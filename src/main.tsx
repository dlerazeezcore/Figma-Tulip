
  import { createRoot } from "react-dom/client";
  import "./app/i18n";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // One-shot cleanup of localStorage keys from the removed Telegram-bridged
  // support chat. Safe to call on every boot: the marker stops it after the
  // first successful sweep on a given device.
  function purgeRemovedSupportChatStorage(): void {
    const MARKER = "support.cleanup.v1";
    try {
      if (localStorage.getItem(MARKER) === "1") return;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key.startsWith("support.conversation.v1.") ||
          key === "supportUploadBucketHint" ||
          key === "supportUploadOriginHint" ||
          key === "supportUploadBucketHintV2" ||
          key === "supportUploadOriginHintV2"
        ) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
      localStorage.setItem(MARKER, "1");
    } catch {
      // localStorage may be unavailable (private mode, quota); skip silently.
    }
  }
  purgeRemovedSupportChatStorage();

  createRoot(document.getElementById("root")!).render(<App />);
  