import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { clearAuth, isAdmin, isAuthenticated } from "./account-service";
import { getNativePushUnavailableReason, isNativePushEnabled } from "./config";
import {
  readStoredPushNotificationsEnabledPreference,
  syncPushUserContext,
  updatePushNotificationsPreference,
} from "./push-notifications-service";
import { addAuthSessionChangeListener, getUserName, getUserPhone } from "./session";

type AuthMode = "login" | "signup";

interface SettingsPreferences {
  notifications: boolean;
  dataWarning: boolean;
  autoRenew: boolean;
}

export interface SettingsPageModel extends SettingsPreferences {
  isAuthenticated: boolean;
  isAdmin: boolean;
  showAuthModal: boolean;
  authMode: AuthMode;
  userPhone: string;
  userName: string;
  userInitials: string;
  setNotifications: (value: boolean) => void;
  setDataWarning: (value: boolean) => void;
  setAutoRenew: (value: boolean) => void;
  setShowAuthModal: (value: boolean) => void;
  openLogin: () => void;
  openSignup: () => void;
  openPersonalInformation: () => void;
  openOrderHistory: () => void;
  openSupportChat: () => void;
  logout: () => void;
  handleAuthSuccess: () => void;
}

const DATA_WARNING_KEY = "settings.dataWarning.enabled";
const AUTO_RENEW_KEY = "settings.autoRenew.enabled";

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = String(localStorage.getItem(key) || "").trim().toLowerCase();
    if (!raw) {
      return fallback;
    }
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
  } catch {
    return fallback;
  }
}

function writeBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}

function buildInitials(name: string): string {
  return String(name || "Guest User")
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

export function useSettingsPageModel(): SettingsPageModel {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotificationsState] = useState(() =>
    readStoredPushNotificationsEnabledPreference(false),
  );
  const [dataWarning, setDataWarningState] = useState(() => readBoolean(DATA_WARNING_KEY, true));
  const [autoRenew, setAutoRenewState] = useState(() => readBoolean(AUTO_RENEW_KEY, false));
  const [userPhone, setUserPhone] = useState(() => getUserPhone());
  const [userName, setUserName] = useState(() => getUserName() || "Guest User");
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());
  const [admin, setAdmin] = useState(() => isAdmin());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  useEffect(() => {
    writeBoolean(DATA_WARNING_KEY, dataWarning);
  }, [dataWarning]);

  useEffect(() => {
    writeBoolean(AUTO_RENEW_KEY, autoRenew);
  }, [autoRenew]);

  useEffect(() => {
    const refreshAuthState = () => {
      setAuthenticated(isAuthenticated());
      setAdmin(isAdmin());
      setUserPhone(getUserPhone());
      setUserName(getUserName() || "Guest User");
      setNotificationsState(readStoredPushNotificationsEnabledPreference(false));
    };

    refreshAuthState();
    const removeAuthListener = addAuthSessionChangeListener(refreshAuthState);
    window.addEventListener("focus", refreshAuthState);
    window.addEventListener("storage", refreshAuthState);

    return () => {
      removeAuthListener();
      window.removeEventListener("focus", refreshAuthState);
      window.removeEventListener("storage", refreshAuthState);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("accountDeleted") !== "1") {
      return;
    }

    toast.success("Account deleted successfully. You can log in again at any time.");
    navigate("/settings", { replace: true });
  }, [location.search, navigate]);

  const userInitials = useMemo(() => buildInitials(userName), [userName]);

  return {
    notifications,
    dataWarning,
    autoRenew,
    isAuthenticated: authenticated,
    isAdmin: admin,
    showAuthModal,
    authMode,
    userPhone,
    userName,
    userInitials,
    setNotifications: (value) => {
      const nextValue = Boolean(value);
      setNotificationsState(nextValue);

      void updatePushNotificationsPreference(nextValue)
        .then((result) => {
          if (result.enabled === nextValue) {
            if (result.reason === "unsupported" && nextValue) {
              toast.info(getNativePushUnavailableReason());
            }
            return;
          }

          setNotificationsState(result.enabled);

          if (nextValue) {
            toast.error("Push notifications were not enabled on this device.");
          }
        })
        .catch((error) => {
          console.error("Failed to update push notifications:", error);
          setNotificationsState(!nextValue);
          toast.error(error instanceof Error ? error.message : "Failed to update push notifications");
        });
    },
    setDataWarning: setDataWarningState,
    setAutoRenew: setAutoRenewState,
    setShowAuthModal,
    openLogin: () => {
      setAuthMode("login");
      setShowAuthModal(true);
    },
    openSignup: () => {
      setAuthMode("signup");
      setShowAuthModal(true);
    },
    openPersonalInformation: () => navigate("/settings/personal-information"),
    openOrderHistory: () => navigate("/my-esims"),
    openSupportChat: () => {
      if (!isAuthenticated()) {
        setAuthMode("login");
        setShowAuthModal(true);
        toast.info("Log in to chat with support");
        return;
      }
      navigate("/support");
    },
    logout: () => {
      clearAuth();
      toast.success("Logged out successfully");
      setAuthenticated(false);
      setAdmin(false);
      setUserPhone("");
      setUserName("Guest User");
      navigate("/");
    },
    handleAuthSuccess: () => {
      setShowAuthModal(false);
      setAuthenticated(isAuthenticated());
      setAdmin(isAdmin());
      setUserPhone(getUserPhone());
      setUserName(getUserName() || "Guest User");
      if (isNativePushEnabled()) {
        void syncPushUserContext().catch((error) => {
          console.warn("Settings auth-success push sync skipped:", error);
        });
      }
      toast.success("Authentication successful");
    },
  };
}
