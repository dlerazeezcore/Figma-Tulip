import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { Toaster } from "./components/ui/sonner";
import { SplashScreen as NativeSplashScreen } from "@capacitor/splash-screen";
import { useTranslation } from "react-i18next";
import { InitSuperAdmin } from "./components/InitSuperAdmin";
import { SplashScreen } from "./components/SplashScreen";
import { ThemeProvider } from "./components/ThemeProvider";
import { LanguageSelectionModal } from "./components/LanguageSelectionModal";
import { router } from "./routes";
import { addAuthSessionChangeListener } from "./wiring/session";
import { addAppUrlOpenListener, closeNativeBrowser, getRouteFromAppUrl, isNativeApp } from "./utils/native-payment";

async function loadPushNotificationsService() {
  return import("./wiring/push-notifications-service");
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const { i18n } = useTranslation();

  useEffect(() => {
    // Sync document direction with language
    const isRtl = i18n.language === 'ar' || i18n.language === 'ku';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => {
    // Hide native splash screen as soon as possible
    if (isNativeApp()) {
      void NativeSplashScreen.hide().catch((err) => {
        console.warn("Failed to hide native splash:", err);
      });
    }

    // Ensure viewport meta prevents iOS input zoom and supports safe areas
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (meta) {
      meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
    } else {
      meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
      document.head.appendChild(meta);
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    let isActive = true;

    const listenerHandlePromise = addAppUrlOpenListener(async ({ url }) => {
      const route = getRouteFromAppUrl(url);
      if (!route) {
        return;
      }

      try {
        await closeNativeBrowser();
      } catch {
        // Best-effort close for the in-app browser after returning from payment.
      }

      if (!isActive) {
        return;
      }

      const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (currentRoute !== route) {
        window.location.assign(route);
      }
    });

    return () => {
      isActive = false;
      void listenerHandlePromise.then((handle) => handle?.remove());
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    let cancelled = false;
    let removeAppStateListener: (() => Promise<void> | void) | null = null;

    const syncPush = async () => {
      const service = await loadPushNotificationsService();
      if (cancelled) {
        return;
      }
      await service.syncPushUserContext();
    };

    void loadPushNotificationsService()
      .then((service) => {
        if (cancelled) {
          return;
        }
        return service.bootstrapPushNotifications();
      })
      .then(() => {
        if (cancelled) {
          return;
        }
        return syncPush();
      })
      .catch((error) => {
        console.error("Failed to bootstrap push notifications:", error);
      });

    const removeAuthListener = addAuthSessionChangeListener(() => {
      void syncPush().catch((error) => {
        console.error("Failed to sync push user context:", error);
      });
    });

    const handleFocus = () => {
      void syncPush().catch((error) => {
        console.error("Failed to refresh push user context:", error);
      });
    };

    window.addEventListener("focus", handleFocus);

    void import("@capacitor/app")
      .then(async ({ App }) => {
        if (!App?.addListener) {
          return;
        }

        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) {
            return;
          }

          void loadPushNotificationsService()
            .then((service) => {
              if (cancelled) {
                return;
              }
              return service.syncPushUserContext();
            })
            .catch((error) => {
              console.error("Failed to sync native app push state:", error);
            });
        });

        if (cancelled) {
          await handle.remove?.();
          return;
        }

        removeAppStateListener = () => handle.remove?.();
      })
      .catch((error) => {
        console.error("Failed to register native app-state listener:", error);
      });

    return () => {
      cancelled = true;
      removeAuthListener();
      window.removeEventListener("focus", handleFocus);
      void removeAppStateListener?.();
    };
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <LanguageSelectionModal />
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <InitSuperAdmin />
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors offset={isNativeApp() ? 52 : 16} />
    </ThemeProvider>
  );
}