import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { getCurrencySettings, getPopularDestinations } from "./catalog-service";
import { resolveCountryName } from "./country-names";
import { useHomeTutorialModel, type HomeTutorialModel } from "./home-tutorial-service";
import { loadMyEsimsPageContent, type MyEsimItem } from "./my-esims-page-service";
import { addAuthSessionChangeListener, getUserId, getUserName, isAuthenticated } from "./session";

export interface HomeDestination {
  id: string | number;
  name: string;
  flag: string;
  code: string;
  priceFrom: number;
  type: "country" | "regional";
}

export interface HomeActiveEsim {
  id: string;
  name: string;
  country: string;
  flag: string;
  dataUsed: number;
  dataTotal: number;
  dataRemaining: number;
  daysLeft: number;
  status: "active";
}

export interface HomePageContent {
  popularDestinations: HomeDestination[];
  activeEsim: HomeActiveEsim | null;
  exchangeRate: string;
  markupPercent: string;
}

export interface HomePopularContent {
  popularDestinations: HomeDestination[];
  exchangeRate: string;
  markupPercent: string;
}

export interface HomePageModel {
  popularDestinations: HomeDestination[];
  activeEsim: HomeActiveEsim | null;
  exchangeRate: string;
  markupPercent: string;
  dataPercentage: number;
  welcomeName: string;
  tutorial: HomeTutorialModel;
  openDestinationPlans: (destination: HomeDestination) => void;
}

const HOME_POPULAR_CONTENT_CACHE_KEY = "home.popular.content.v1";
const HOME_POPULAR_CODES_CACHE_KEY = "home.popular.codes.v1";
const HOME_MY_ESIMS_SNAPSHOT_KEY_PREFIX = "esim.myEsims.snapshot.v2.";

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractNumber(value: unknown, fallback = 0): number {
  const text = String(value ?? "");
  const matched = text.match(/-?\d+(\.\d+)?/);
  if (!matched) {
    return fallback;
  }
  return toNumber(matched[0], fallback);
}

function flagFromIso(code: string): string {
  const iso = String(code || "").trim().toUpperCase();
  if (iso.length !== 2) {
    return "🌍";
  }
  return String.fromCodePoint(127397 + iso.charCodeAt(0), 127397 + iso.charCodeAt(1));
}

function resolveDisplayFlag(rawFlag: unknown, code: string): string {
  const candidate = String(rawFlag || "").trim();
  if (!candidate || candidate.includes("\uFFFD") || /^\?+$/.test(candidate)) {
    return flagFromIso(code);
  }
  return candidate;
}

function buildFallbackDestinationFromCode(code: string): HomeDestination {
  const normalizedCode = String(code || "").trim().toUpperCase();
  return {
    id: normalizedCode,
    name: resolveCountryName(normalizedCode) || normalizedCode || "Unknown",
    flag: flagFromIso(normalizedCode),
    code: normalizedCode,
    priceFrom: 0,
    type: "country",
  };
}

function normalizeDestination(item: any): HomeDestination {
  const code = String(item?.code || item?.iso || "").trim();
  return {
    id: item?.id ?? code,
    name: String(item?.name || resolveCountryName(code) || code || "Unknown"),
    flag: resolveDisplayFlag(item?.flag, code),
    code,
    priceFrom: toNumber(item?.priceFrom ?? item?.price_from, 0),
    type: String(item?.type || "").toLowerCase() === "regional" ? "regional" : "country",
  };
}

function readPopularCodesCache(): string[] {
  try {
    const raw = String(localStorage.getItem(HOME_POPULAR_CODES_CACHE_KEY) || "").trim();
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => String(item || "").trim().toUpperCase())
      .filter((item) => item.length === 2);
  } catch {
    return [];
  }
}

function writePopularCodesCache(destinations: HomeDestination[]): void {
  try {
    const codes = destinations
      .map((item) => String(item.code || "").trim().toUpperCase())
      .filter((item) => item.length === 2);
    localStorage.setItem(HOME_POPULAR_CODES_CACHE_KEY, JSON.stringify(codes));
  } catch {
    // Ignore storage failures.
  }
}

function readHomePopularContentCache(): HomePopularContent | null {
  try {
    const raw = String(localStorage.getItem(HOME_POPULAR_CONTENT_CACHE_KEY) || "").trim();
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as HomePopularContent;
    if (!parsed || !Array.isArray(parsed.popularDestinations)) {
      return null;
    }

    return {
      popularDestinations: parsed.popularDestinations.map(normalizeDestination),
      exchangeRate: String(parsed.exchangeRate || "1320"),
      markupPercent: String(parsed.markupPercent || "0"),
    };
  } catch {
    return null;
  }
}

function writeHomePopularContentCache(content: HomePopularContent): void {
  try {
    localStorage.setItem(HOME_POPULAR_CONTENT_CACHE_KEY, JSON.stringify(content));
  } catch {
    // Ignore storage failures.
  }
}

function buildPopularFromCodes(codes: string[]): HomeDestination[] {
  return codes.map(buildFallbackDestinationFromCode);
}

function normalizeActiveEsim(item: MyEsimItem): HomeActiveEsim {
  return {
    id: String(item.id || ""),
    name: String(item.name || item.country || "Active eSIM"),
    country: String(item.country || "Unknown"),
    flag: resolveDisplayFlag(item.flag, item.countryCode),
    dataUsed: Math.max(0, extractNumber(item.dataUsed, 0)),
    dataTotal: Math.max(0, extractNumber(item.dataTotal, 0)),
    dataRemaining: Math.max(0, extractNumber(item.dataRemaining, 0)),
    daysLeft: Math.max(0, Math.floor(extractNumber(item.daysLeft, 0))),
    status: "active",
  };
}

export function buildPlansRouteFromDestination(destination: HomeDestination): string {
  if (!destination.code) {
    return "/plans";
  }
  return `/plans?type=${encodeURIComponent(destination.type)}&code=${encodeURIComponent(destination.code)}`;
}

export function getImmediateHomePopularContent(): HomePopularContent {
  const cached = readHomePopularContentCache();
  if (cached) {
    return cached;
  }

  const cachedCodes = readPopularCodesCache();
  return {
    popularDestinations: buildPopularFromCodes(cachedCodes),
    exchangeRate: "1320",
    markupPercent: "0",
  };
}

export async function loadHomePopularContent(): Promise<HomePopularContent> {
  const [popularResponse, currencyResponse] = await Promise.all([
    getPopularDestinations(),
    getCurrencySettings(),
  ]);

  const cached = readHomePopularContentCache();
  const cachedCodes = readPopularCodesCache();

  const popularDestinations =
    popularResponse.success && Array.isArray(popularResponse.data)
      ? popularResponse.data.map(normalizeDestination)
      : cached?.popularDestinations || buildPopularFromCodes(cachedCodes);

  const exchangeRate = String(currencyResponse.data?.exchangeRate || cached?.exchangeRate || "1320");
  const markupPercent = String(currencyResponse.data?.markupPercent || cached?.markupPercent || "0");

  const content: HomePopularContent = {
    popularDestinations,
    exchangeRate,
    markupPercent,
  };

  writeHomePopularContentCache(content);
  writePopularCodesCache(popularDestinations);

  return content;
}

export async function loadHomeActiveEsimContent(): Promise<HomeActiveEsim | null> {
  // Home only needs a summary card, so avoid the heavier lifecycle/top-up enrichment pass here.
  const myEsimsRows = await loadMyEsimsPageContent({
    includeTopUpSupport: false,
    includeOrderLifecycle: false,
    includeDestinationLookup: false,
  });
  const activeEsims = myEsimsRows.filter((item) => item.status === "active" && item.isInstalled);
  return activeEsims.length > 0 ? normalizeActiveEsim(activeEsims[0]) : null;
}

function readImmediateHomeActiveEsimFromSnapshot(): HomeActiveEsim | null {
  try {
    const userId = String(getUserId() || "").trim();
    if (!userId) {
      return null;
    }
    const raw = String(localStorage.getItem(HOME_MY_ESIMS_SNAPSHOT_KEY_PREFIX + userId) || "").trim();
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [];
    const active = rows.find((item: any) =>
      item &&
      typeof item === "object" &&
      String(item.status || "").toLowerCase() === "active" &&
      Boolean(item.isInstalled),
    );
    if (!active) {
      return null;
    }
    return normalizeActiveEsim(active as MyEsimItem);
  } catch {
    return null;
  }
}

export async function loadHomePageContent(): Promise<HomePageContent> {
  const [popularContent, activeEsim] = await Promise.all([
    loadHomePopularContent(),
    loadHomeActiveEsimContent(),
  ]);

  return {
    ...popularContent,
    activeEsim,
  };
}

export function useHomePageModel(): HomePageModel {
  const navigate = useNavigate();
  const tutorial = useHomeTutorialModel();
  const immediatePopularContent = getImmediateHomePopularContent();
  const immediateActiveEsim = readImmediateHomeActiveEsimFromSnapshot();
  const [popularDestinations, setPopularDestinations] = useState<HomeDestination[]>(
    immediatePopularContent.popularDestinations,
  );
  const [activeEsim, setActiveEsim] = useState<HomeActiveEsim | null>(immediateActiveEsim);
  const [exchangeRate, setExchangeRate] = useState(immediatePopularContent.exchangeRate);
  const [markupPercent, setMarkupPercent] = useState(immediatePopularContent.markupPercent);
  const [welcomeName, setWelcomeName] = useState(() =>
    isAuthenticated() ? String(getUserName() || "").trim() : "",
  );

  useEffect(() => {
    const loadPopular = async () => {
      const content = await loadHomePopularContent();
      setPopularDestinations(content.popularDestinations);
      setExchangeRate(content.exchangeRate);
      setMarkupPercent(content.markupPercent);
    };

    void loadPopular();

    const handlePopularUpdated = () => void loadPopular();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadPopular();
    };
    window.addEventListener("tulip:popular-updated", handlePopularUpdated);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("tulip:popular-updated", handlePopularUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const loadActiveEsim = async () => {
      const content = await loadHomeActiveEsimContent();
      setActiveEsim(content);
    };

    void loadActiveEsim();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadActiveEsim();
      }
    };
    window.addEventListener("focus", loadActiveEsim);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", loadActiveEsim);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    const refreshUserName = () => {
      setWelcomeName(isAuthenticated() ? String(getUserName() || "").trim() : "");
    };

    refreshUserName();
    const removeAuthListener = addAuthSessionChangeListener(refreshUserName);
    window.addEventListener("focus", refreshUserName);

    return () => {
      removeAuthListener();
      window.removeEventListener("focus", refreshUserName);
    };
  }, []);

  const dataPercentage = useMemo(() => {
    if (!activeEsim || activeEsim.dataTotal <= 0) {
      return 0;
    }

    return Math.min(100, (activeEsim.dataUsed / activeEsim.dataTotal) * 100);
  }, [activeEsim]);

  return {
    popularDestinations,
    activeEsim,
    exchangeRate,
    markupPercent,
    dataPercentage,
    welcomeName,
    tutorial,
    openDestinationPlans: (destination) => navigate(buildPlansRouteFromDestination(destination)),
  };
}
