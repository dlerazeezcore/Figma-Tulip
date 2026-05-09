
  import { createRoot } from "react-dom/client";
  import "./app/i18n";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // One-shot cleanup of localStorage keys from features we removed:
  // the Telegram-bridged support chat and the Home Tutorial Video.
  // Safe to call on every boot: the marker stops it after the first
  // successful sweep on a given device.
  function purgeRemovedFeatureStorage(): void {
    const MARKER = "removed-features.cleanup.v2";
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
          key === "supportUploadOriginHintV2" ||
          key === "home-tutorial.settings" ||
          key === "home-tutorial.settings.cached" ||
          key === "settings.whitelist" ||
          // Drop the older v1 marker so we know we ran the v2 sweep.
          key === "support.cleanup.v1"
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
  purgeRemovedFeatureStorage();

  createRoot(document.getElementById("root")!).render(<App />);
  