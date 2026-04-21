import { useEffect, useMemo, useState } from "react";
import { isBackendCapabilityEnabled } from "./config";
import { requestApi } from "./http";
import { getCachedResource, primeCachedResource } from "./query-cache";

export type HomeTutorialPlatform = "iphone" | "android";

export interface HomeTutorialPlatformConfig {
  videoUrl: string;
  thumbnailUrl: string;
  description: string;
  durationLabel: string;
}

export interface HomeTutorialSettings {
  enabled: boolean;
  cardTitle: string;
  cardSubtitle: string;
  modalTitle: string;
  iphone: HomeTutorialPlatformConfig;
  android: HomeTutorialPlatformConfig;
}

export interface HomeTutorialModel {
  isVisible: boolean;
  isModalOpen: boolean;
  selectedPlatform: HomeTutorialPlatform;
  availablePlatformCount: number;
  cardTitle: string;
  cardSubtitle: string;
  cardThumbnailUrl: string;
  cardPreviewVideoUrl: string;
  cardCountLabel: string;
  cardHintLabel: string;
  modalTitle: string;
  selectedVideoUrl: string;
  selectedPosterUrl: string;
  selectedDescription: string;
  selectedDurationLabel: string;
  videoLoadingState: "idle" | "loading" | "loaded" | "error";
  videoElementKey: string;
  isPlatformAvailable: (platform: HomeTutorialPlatform) => boolean;
  openModal: () => void;
  closeModal: () => void;
  selectPlatform: (platform: HomeTutorialPlatform) => void;
  handleVideoLoadStart: () => void;
  handleVideoLoaded: () => void;
  handleVideoError: () => void;
  retry: () => void;
}

const HOME_TUTORIAL_EVENT = "home-tutorial-settings-changed";
const HOME_TUTORIAL_CACHE_KEY = "home-tutorial.settings";
const HOME_TUTORIAL_CACHE_TTL_MS = 30 * 1000;
const HOME_TUTORIAL_LOCAL_STORAGE_KEY = "home-tutorial.settings.cached";

const DEFAULT_TUTORIAL_SETTINGS: HomeTutorialSettings = {
  enabled: false,
  cardTitle: "How to activate and use your eSIM",
  cardSubtitle: "Separate tutorials for iPhone and Android",
  modalTitle: "eSIM Activation Tutorial",
  iphone: {
    videoUrl: "",
    thumbnailUrl: "",
    description:
      "This tutorial shows you exactly how to install and activate your eSIM on iPhone. Follow along step-by-step to get connected in minutes.",
    durationLabel: "",
  },
  android: {
    videoUrl: "",
    thumbnailUrl: "",
    description:
      "This tutorial shows you exactly how to install and activate your eSIM on Android. Follow along step-by-step to get connected in minutes.",
    durationLabel: "",
  },
};

const BUNDLED_TUTORIAL_SETTINGS: HomeTutorialSettings = {
  enabled: true,
  cardTitle: "How to activate and use your eSIM",
  cardSubtitle: "Separate tutorials for iPhone and Android",
  modalTitle: "eSIM Activation Tutorial",
  iphone: {
    videoUrl:
      "https://orfcrujrzvmpkefyfqpo.supabase.co/storage/v1/object/public/esim-app-home-tutorials/esim-app/home-tutorial/iphone/video/20260331T072900Z-b8bf7ae4a17f4a3fb0a3ca69baa4b06d.mp4",
    thumbnailUrl: "",
    description:
      "This tutorial shows you exactly how to install and activate your eSIM on iPhone. Follow along step-by-step to get connected in minutes.",
    durationLabel: "",
  },
  android: {
    videoUrl: "",
    thumbnailUrl: "",
    description:
      "This tutorial shows you exactly how to install and activate your eSIM on Android. Follow along step-by-step to get connected in minutes.",
    durationLabel: "",
  },
};

let cachedTutorialSettings: HomeTutorialSettings = DEFAULT_TUTORIAL_SETTINGS;

function readLocalTutorialCache(): HomeTutorialSettings {
  try {
    const raw = String(localStorage.getItem(HOME_TUTORIAL_LOCAL_STORAGE_KEY) || "").trim();
    if (!raw) {
      return DEFAULT_TUTORIAL_SETTINGS;
    }

    return normalizeTutorialSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_TUTORIAL_SETTINGS;
  }
}

function writeLocalTutorialCache(settings: HomeTutorialSettings): void {
  try {
    localStorage.setItem(HOME_TUTORIAL_LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures.
  }
}

function normalizeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizePlatformConfig(
  value: unknown,
  fallback: HomeTutorialPlatformConfig,
): HomeTutorialPlatformConfig {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    videoUrl: normalizeText(record.videoUrl, fallback.videoUrl),
    thumbnailUrl: normalizeText(record.thumbnailUrl, fallback.thumbnailUrl),
    description: normalizeText(record.description, fallback.description),
    durationLabel: normalizeText(record.durationLabel, fallback.durationLabel),
  };
}

function normalizeTutorialSettings(value: unknown): HomeTutorialSettings {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    enabled: Boolean(record.enabled ?? DEFAULT_TUTORIAL_SETTINGS.enabled),
    cardTitle: normalizeText(record.cardTitle, DEFAULT_TUTORIAL_SETTINGS.cardTitle),
    cardSubtitle: normalizeText(record.cardSubtitle, DEFAULT_TUTORIAL_SETTINGS.cardSubtitle),
    modalTitle: normalizeText(record.modalTitle, DEFAULT_TUTORIAL_SETTINGS.modalTitle),
    iphone: normalizePlatformConfig(record.iphone, DEFAULT_TUTORIAL_SETTINGS.iphone),
    android: normalizePlatformConfig(record.android, DEFAULT_TUTORIAL_SETTINGS.android),
  };
}

function emitTutorialSettingsChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(HOME_TUTORIAL_EVENT));
  } catch {
    // Ignore event dispatch failures.
  }
}

function hasVideoForPlatform(
  settings: HomeTutorialSettings,
  platform: HomeTutorialPlatform,
): boolean {
  return Boolean(normalizeText(settings[platform].videoUrl));
}

function getAvailablePlatforms(settings: HomeTutorialSettings): HomeTutorialPlatform[] {
  return (["iphone", "android"] as HomeTutorialPlatform[]).filter((platform) =>
    hasVideoForPlatform(settings, platform),
  );
}

function detectDevicePlatform(): HomeTutorialPlatform {
  if (typeof navigator === "undefined") {
    return "iphone";
  }

  const userAgent = String(navigator.userAgent || "").toLowerCase();
  const platform = String(navigator.platform || "").toLowerCase();
  const maxTouchPoints = Number((navigator as any).maxTouchPoints || 0);

  if (userAgent.includes("android")) {
    return "android";
  }

  const isAppleTouchDevice =
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === "macintel" && maxTouchPoints > 1);

  return isAppleTouchDevice ? "iphone" : "android";
}

function getPreferredPlatform(settings: HomeTutorialSettings): HomeTutorialPlatform {
  const detected = detectDevicePlatform();
  if (hasVideoForPlatform(settings, detected)) {
    return detected;
  }

  const availablePlatforms = getAvailablePlatforms(settings);
  return availablePlatforms[0] || detected;
}

function getCardThumbnailUrl(settings: HomeTutorialSettings): string {
  const preferred = getPreferredPlatform(settings);
  if (settings[preferred].thumbnailUrl) {
    return settings[preferred].thumbnailUrl;
  }

  const availablePlatforms = getAvailablePlatforms(settings);
  for (const platform of availablePlatforms) {
    if (settings[platform].thumbnailUrl) {
      return settings[platform].thumbnailUrl;
    }
  }

  return "";
}

function getCardPreviewVideoUrl(settings: HomeTutorialSettings): string {
  const preferred = getPreferredPlatform(settings);
  if (settings[preferred].videoUrl) {
    return settings[preferred].videoUrl;
  }

  const availablePlatforms = getAvailablePlatforms(settings);
  return availablePlatforms.length > 0 ? settings[availablePlatforms[0]].videoUrl : "";
}

function buildVideoState(
  settings: HomeTutorialSettings,
  platform: HomeTutorialPlatform,
): "idle" | "loading" | "loaded" | "error" {
  return hasVideoForPlatform(settings, platform) ? "loading" : "error";
}

function setCachedTutorialSettings(settings: HomeTutorialSettings): HomeTutorialSettings {
  cachedTutorialSettings = normalizeTutorialSettings(settings);
  writeLocalTutorialCache(cachedTutorialSettings);
  return cachedTutorialSettings;
}

function getBestCachedTutorialSettings(): HomeTutorialSettings {
  const localCached = readLocalTutorialCache();
  if (localCached.enabled || getAvailablePlatforms(localCached).length > 0) {
    return localCached;
  }

  if (cachedTutorialSettings.enabled || getAvailablePlatforms(cachedTutorialSettings).length > 0) {
    return cachedTutorialSettings;
  }

  return BUNDLED_TUTORIAL_SETTINGS;
}

function getCachedTutorialSettings(): HomeTutorialSettings {
  return cachedTutorialSettings;
}

function extractSettingsPayload(payload: any): HomeTutorialSettings {
  const normalized = normalizeTutorialSettings(
    payload?.data?.tutorial ||
      payload?.data ||
      payload?.tutorial ||
      payload,
  );
  return setCachedTutorialSettings(normalized);
}

export async function getHomeTutorialSettings(): Promise<HomeTutorialSettings> {
  return getCachedResource(HOME_TUTORIAL_CACHE_KEY, HOME_TUTORIAL_CACHE_TTL_MS, async () => {
    if (!isBackendCapabilityEnabled("homeTutorial")) {
      return getCachedTutorialSettings();
    }

    const primary = await requestApi("/home-tutorial/current");
    if (primary.success) {
      return extractSettingsPayload(primary.data);
    }

    return getCachedTutorialSettings();
  });
}

export async function updateHomeTutorialSettings(
  value: Partial<HomeTutorialSettings>,
): Promise<HomeTutorialSettings> {
  if (!isBackendCapabilityEnabled("homeTutorial")) {
    throw new Error("Home tutorial settings are not available in backendformobileapp yet.");
  }

  const current = await getHomeTutorialSettings();
  const merged = normalizeTutorialSettings({
    ...current,
    ...value,
    iphone: {
      ...current.iphone,
      ...(value.iphone || {}),
    },
    android: {
      ...current.android,
      ...(value.android || {}),
    },
  });

  const response = await requestApi("/home-tutorial", {
    method: "POST",
    body: merged,
  });

  if (!response.success) {
    throw new Error(response.error || "Failed to update home tutorial settings");
  }

  const next = extractSettingsPayload(response.data || merged);
  primeCachedResource(HOME_TUTORIAL_CACHE_KEY, next, HOME_TUTORIAL_CACHE_TTL_MS);
  emitTutorialSettingsChanged();
  return next;
}

cachedTutorialSettings = getBestCachedTutorialSettings();

export function useHomeTutorialModel(): HomeTutorialModel {
  const [settings, setSettings] = useState<HomeTutorialSettings>(() => getBestCachedTutorialSettings());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<HomeTutorialPlatform>(
    getPreferredPlatform(getBestCachedTutorialSettings()),
  );
  const [videoLoadingState, setVideoLoadingState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [videoRefreshNonce, setVideoRefreshNonce] = useState(0);

  useEffect(() => {
    const refreshSettings = () => {
      setSettings(getBestCachedTutorialSettings());
    };

    refreshSettings();
    void getHomeTutorialSettings()
      .then((next) => {
        setSettings(next);
      })
      .catch(() => {
        setSettings(DEFAULT_TUTORIAL_SETTINGS);
      });

    window.addEventListener(HOME_TUTORIAL_EVENT, refreshSettings);

    return () => {
      window.removeEventListener(HOME_TUTORIAL_EVENT, refreshSettings);
    };
  }, []);

  const availablePlatforms = useMemo(() => getAvailablePlatforms(settings), [settings]);
  const isVisible = Boolean(settings.enabled && availablePlatforms.length > 0);
  const selectedConfig = settings[selectedPlatform];
  const selectedVideoUrl = normalizeText(selectedConfig.videoUrl);
  const selectedPosterUrl = normalizeText(selectedConfig.thumbnailUrl);

  useEffect(() => {
    if (!isVisible) {
      setIsModalOpen(false);
      setVideoLoadingState("idle");
      return;
    }

    if (!hasVideoForPlatform(settings, selectedPlatform) && availablePlatforms.length > 0) {
      setSelectedPlatform(getPreferredPlatform(settings));
    }
  }, [availablePlatforms.length, isVisible, selectedPlatform, settings]);

  const cardThumbnailUrl = useMemo(() => getCardThumbnailUrl(settings), [settings]);
  const cardPreviewVideoUrl = useMemo(() => getCardPreviewVideoUrl(settings), [settings]);

  return {
    isVisible,
    isModalOpen,
    selectedPlatform,
    availablePlatformCount: availablePlatforms.length,
    cardTitle: settings.cardTitle,
    cardSubtitle: settings.cardSubtitle,
    cardThumbnailUrl,
    cardPreviewVideoUrl,
    cardCountLabel: availablePlatforms.length === 1 ? "1 Tutorial" : `${availablePlatforms.length} Tutorials`,
    cardHintLabel: availablePlatforms.length > 1 ? "Choose your device" : "Available now",
    modalTitle: settings.modalTitle,
    selectedVideoUrl,
    selectedPosterUrl,
    selectedDescription: selectedConfig.description,
    selectedDurationLabel: selectedConfig.durationLabel,
    videoLoadingState,
    videoElementKey: `${selectedPlatform}:${selectedVideoUrl}:${videoRefreshNonce}`,
    isPlatformAvailable: (platform) => hasVideoForPlatform(settings, platform),
    openModal: () => {
      const nextPlatform = getPreferredPlatform(settings);
      setSelectedPlatform(nextPlatform);
      setIsModalOpen(true);
      setVideoLoadingState(buildVideoState(settings, nextPlatform));
      setVideoRefreshNonce((value) => value + 1);
    },
    closeModal: () => {
      setIsModalOpen(false);
      setVideoLoadingState("idle");
      setSelectedPlatform(getPreferredPlatform(settings));
    },
    selectPlatform: (platform) => {
      setSelectedPlatform(platform);
      setVideoLoadingState(buildVideoState(settings, platform));
      setVideoRefreshNonce((value) => value + 1);
    },
    handleVideoLoadStart: () => {
      setVideoLoadingState(selectedVideoUrl ? "loading" : "error");
    },
    handleVideoLoaded: () => {
      setVideoLoadingState("loaded");
    },
    handleVideoError: () => {
      setVideoLoadingState("error");
    },
    retry: () => {
      setVideoLoadingState(buildVideoState(settings, selectedPlatform));
      setVideoRefreshNonce((value) => value + 1);
    },
  };
}
