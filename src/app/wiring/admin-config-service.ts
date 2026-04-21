import { isBackendCapabilityEnabled } from "./config";
import { requestApi } from "./http";

export {
  addSuperAdmin,
  blockUserAccount,
  clearAdminPopularDestinations,
  deleteUserAccount,
  editUserAccount,
  getAdminPopularDestinations,
  getCurrencySettings,
  getPushNotificationSummary,
  getSuperAdmins,
  getUsers,
  getWhitelistSettings,
  grantUserLoyalty,
  removeSuperAdmin,
  sendAppUpdatePushNotification,
  sendPushNotification,
  setAdminPopularDestinations,
  updateCurrencySettings,
  updateWhitelistSettings,
} from "./esim-app-service";

export {
  getHomeTutorialSettings,
  updateHomeTutorialSettings,
} from "./home-tutorial-service";

function extractUploadUrl(payload: any): string {
  const candidates = [
    payload?.url,
    payload?.publicUrl,
    payload?.fileUrl,
    payload?.data?.url,
    payload?.data?.publicUrl,
    payload?.data?.fileUrl,
    payload?.result?.url,
    payload?.result?.publicUrl,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

export async function uploadHomeTutorialAsset(payload: {
  platform: "iphone" | "android";
  assetType: "video" | "thumbnail";
  file: File;
}): Promise<{ url: string }> {
  if (!isBackendCapabilityEnabled("homeTutorial")) {
    throw new Error("Tutorial asset upload is not available in backendformobileapp yet.");
  }

  const form = new FormData();
  form.append("platform", payload.platform);
  form.append("assetType", payload.assetType);
  form.append("file", payload.file);

  const response = await requestApi("/home-tutorial/upload", {
    method: "POST",
    body: form,
  });

  if (!response.success) {
    throw new Error(response.error || "Failed to upload tutorial asset");
  }

  const url = extractUploadUrl(response.data);
  if (!url) {
    throw new Error("Upload completed but no file URL was returned");
  }

  return { url };
}
