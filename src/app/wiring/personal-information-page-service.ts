import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  clearAuth,
  deleteMyAccount,
  getAccountDeletionUrl,
  getUserEmail,
  getUserName,
  getUserPhone,
  isAuthenticated,
  loadMyProfile,
  updateMyProfile,
} from "./account-service";
import { addAuthSessionChangeListener } from "./session";

interface SaveResult {
  success: boolean;
  fieldError?: string;
  cleared?: boolean;
}

export interface PersonalInformationPageModel {
  isDeleting: boolean;
  isSavingProfile: boolean;
  isAuthenticated: boolean;
  userName: string;
  userPhone: string;
  userEmail: string;
  deletionUrl: string;
  goBack: () => void;
  handleDeleteAccount: () => Promise<void>;
  handleUpdateName: (name: string) => Promise<SaveResult>;
  handleUpdateEmail: (email: string | null) => Promise<SaveResult>;
}

export function usePersonalInformationPageModel(): PersonalInformationPageModel {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [userName, setUserNameState] = useState(getUserName() || "Guest User");
  const [userPhone, setUserPhoneState] = useState(getUserPhone() || "Not available");
  const [userEmail, setUserEmailState] = useState(getUserEmail());
  const deletionUrl = getAccountDeletionUrl();

  useEffect(() => {
    const syncFromSession = () => {
      setAuthenticated(isAuthenticated());
      setUserNameState(getUserName() || "Guest User");
      setUserPhoneState(getUserPhone() || "Not available");
      setUserEmailState(getUserEmail());
    };

    const unsubscribe = addAuthSessionChangeListener(syncFromSession);
    syncFromSession();

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    let cancelled = false;

    void loadMyProfile().then((response) => {
      if (cancelled) {
        return;
      }

      if (response.success && response.data) {
        setUserNameState(response.data.name || "Guest User");
        setUserPhoneState(response.data.phone || "Not available");
        setUserEmailState(String(response.data.email || "").trim());
        return;
      }

      if (response.statusCode === 401) {
        clearAuth();
        navigate("/settings");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authenticated, navigate]);

  const handleUnauthorized = () => {
    clearAuth();
    toast.error("Session expired. Please log in again.");
    navigate("/settings");
  };

  return {
    isDeleting,
    isSavingProfile,
    isAuthenticated: authenticated,
    userName,
    userPhone,
    userEmail,
    deletionUrl,
    goBack: () => navigate("/settings"),
    handleDeleteAccount: async () => {
      if (!authenticated) {
        toast.error("Please log in first");
        navigate("/settings");
        return;
      }

      setIsDeleting(true);
      const response = await deleteMyAccount();
      setIsDeleting(false);

      if (response.success) {
        clearAuth();
        toast.success("Your account was deleted and signed out");
        navigate("/settings?accountDeleted=1", { replace: true });
        return;
      }

      if (deletionUrl) {
        window.location.href = deletionUrl;
        return;
      }

      toast.error(response.error || "Unable to delete account right now");
    },
    handleUpdateName: async (name: string) => {
      if (!authenticated) {
        toast.error("Please log in first");
        navigate("/settings");
        return { success: false, fieldError: "Please log in first." };
      }

      const trimmedName = String(name || "").trim();
      if (trimmedName.length < 2) {
        return { success: false, fieldError: "Name must be at least 2 characters." };
      }

      if (trimmedName === userName.trim()) {
        return { success: true };
      }

      setIsSavingProfile(true);
      const response = await updateMyProfile({ name: trimmedName });
      setIsSavingProfile(false);

      if (response.success && response.data) {
        setUserNameState(response.data.name || "Guest User");
        setUserPhoneState(response.data.phone || "Not available");
        setUserEmailState(String(response.data.email || "").trim());
        return { success: true };
      }

      if (response.statusCode === 401) {
        handleUnauthorized();
        return { success: false, fieldError: "Session expired. Please log in again." };
      }

      if (response.statusCode === 403) {
        toast.error("This account is inactive or not allowed to update profile details.");
        return { success: false, fieldError: "This account is inactive or forbidden." };
      }

      if (response.statusCode === 422) {
        return { success: false, fieldError: response.error || "Please enter a valid name." };
      }

      toast.error(response.error || "Unable to update your name right now.");
      return { success: false, fieldError: response.error || "Unable to update your name right now." };
    },
    handleUpdateEmail: async (email) => {
      if (!authenticated) {
        toast.error("Please log in first");
        navigate("/settings");
        return { success: false, fieldError: "Please log in first." };
      }

      const nextEmail = email === null ? null : String(email || "").trim().toLowerCase();
      const currentEmail = userEmail.trim().toLowerCase();
      if ((nextEmail || "") === currentEmail) {
        return { success: true, cleared: !nextEmail };
      }

      setIsSavingProfile(true);
      const response = await updateMyProfile({ email: nextEmail === "" ? null : nextEmail });
      setIsSavingProfile(false);

      if (response.success && response.data) {
        setUserNameState(response.data.name || "Guest User");
        setUserPhoneState(response.data.phone || "Not available");
        setUserEmailState(String(response.data.email || "").trim());
        return { success: true, cleared: !response.data.email };
      }

      if (response.statusCode === 401) {
        handleUnauthorized();
        return { success: false, fieldError: "Session expired. Please log in again." };
      }

      if (response.statusCode === 403) {
        toast.error("This account is inactive or not allowed to update profile details.");
        return { success: false, fieldError: "This account is inactive or forbidden." };
      }

      if (response.statusCode === 409) {
        return { success: false, fieldError: "Email already in use" };
      }

      if (response.statusCode === 422) {
        return { success: false, fieldError: response.error || "Please enter a valid email address." };
      }

      toast.error(response.error || "Unable to update your email right now.");
      return { success: false, fieldError: response.error || "Unable to update your email right now." };
    },
  };
}
