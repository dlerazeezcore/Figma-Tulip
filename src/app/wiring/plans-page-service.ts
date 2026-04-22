import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { isAuthenticated as hasAuthenticatedSession, login, signup } from "./account-service";
import { getAllDestinations, getCountryPlans, getCurrencySettings, getRegionPlans, getPopularDestinations } from "./catalog-service";
import type { ApiResponse } from "./types";
import { resolveCountryName, shouldExpandIsoName } from "./country-names";
import { formatDataAllowance } from "../utils/data-allowance";

export interface PlansDestination {
  id: string | number;
  name: string;
  flag: string;
  code: string;
  type: "country" | "regional";
  priceFrom: number;
  plansCount: number;
}

export interface PlansBundle {
  id: string;
  data: number;
  validity: number;
  price: number;
  unlimited: boolean;
  isPerDay: boolean;
  dataLabel: string;
  includedCountries: { name: string; code: string }[];
}

export interface PlansPageContext {
  countries: PlansDestination[];
  regions: PlansDestination[];
  exchangeRate: string;
  markupPercent: string;
}

export interface CheckoutPayload {
  country: {
    name: string;
    flag: string;
    code: string;
    type: "country" | "regional";
  };
  plan: {
    id: string;
    data: number;
    validity: number;
    price: number;
  };
}

export type PlansTabType = "country" | "regional";

export interface PlansPageModel {
  activeTab: PlansTabType;
  searchQuery: string;
  countries: PlansDestination[];
  regions: PlansDestination[];
  popularDestinations: PlansDestination[];
  selectedDestination: PlansDestination | null;
  bundles: PlansBundle[];
  selectedBundleId: string;
  isLoadingDestinations: boolean;
  isLoadingBundles: boolean;
  exchangeRate: string;
  markupPercent: string;
  showAuthModal: boolean;
  filteredDestinations: PlansDestination[];
  groupedBundles: Array<{ validity: number; offers: PlansBundle[] }>;
  getDestinationPreview: (destination: PlansDestination) => { priceFrom: number; plansCount: number };
  setActiveTab: (value: PlansTabType) => void;
  setSearchQuery: (value: string) => void;
  setSelectedBundleId: (value: string) => void;
  setShowAuthModal: (value: boolean) => void;
  selectDestination: (destination: PlansDestination) => void;
  clearSelectedDestination: () => void;
  handleContinue: () => void;
  handleAuthSuccess: () => void;
}

const FALLBACK_REGIONS: PlansDestination[] = [
  { id: "r-1", name: "Europe", flag: "🇪🇺", code: "region-europe", type: "regional", priceFrom: 1.6, plansCount: 0 },
  { id: "r-2", name: "Global (120+ areas)", flag: "🌍", code: "region-global-120-areas", type: "regional", priceFrom: 4.45, plansCount: 0 },
];

const PLANS_CONTEXT_CACHE_KEY = "plans.page.context.v2";
const DESTINATION_PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const destinationPreviewCache = new Map<string, { value: { priceFrom: number; plansCount: number }; expiresAt: number }>();
const LOCAL_COUNTRY_CODES = [
  "AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BS",
  "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR", "IO",
  "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CN", "CX", "CC", "CO",
  "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC",
  "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF", "GA",
  "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT",
  "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP",
  "JE", "JO", "KZ", "KE", "KI", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU",
  "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC",
  "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU",
  "NF", "KP", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL",
  "PT", "PR", "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM",
  "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "KR", "SS",
  "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO",
  "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "UM", "US", "UY", "UZ", "VU", "VE",
  "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW", "AX", "XK", "AN",
] as const;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function buildLocalCountries(): PlansDestination[] {
  return LOCAL_COUNTRY_CODES.map((code) => ({
    id: code,
    name: resolveCountryName(code) || code,
    flag: flagFromIso(code),
    code,
    type: "country" as const,
    priceFrom: 0,
    plansCount: 0,
  }));
}

const FALLBACK_COUNTRIES: PlansDestination[] = sortDestinations(buildLocalCountries());

function normalizeDestinationRow(row: any): PlansDestination {
  const code = String(row?.code || row?.iso || row?.country_code || "").trim();
  const type = String(row?.type || "").toLowerCase() === "regional" || code.length > 2 || code.startsWith("region-") ? "regional" : "country";
  const rawName = String(row?.name || row?.country_name || code || "Unknown").trim();
  const normalizedCode = code.toUpperCase();
  const expandedName =
    type === "country" && shouldExpandIsoName(rawName, normalizedCode)
      ? resolveCountryName(normalizedCode)
      : "";

  return {
    id: row?.id ?? code,
    name: expandedName || rawName,
    flag: resolveDisplayFlag(row?.flag || row?.emoji, normalizedCode),
    code,
    type,
    priceFrom: toNumber(row?.priceFrom ?? row?.price_from ?? row?.min_price ?? row?.price, 0),
    plansCount: toNumber(row?.plansCount ?? row?.plans, 0),
  };
}

function normalizeBundleRow(row: any, index: number): PlansBundle {
  const id = String(row?.id ?? row?.bundleName ?? row?.bundle_name ?? `bundle-${index + 1}`);
  const data = toNumber(row?.data ?? row?.dataGB ?? row?.data_gb ?? row?.volume, 0);
  const perDayKeywordSource = buildPerDayKeywordSource(row, id);
  const fromKeyword = /(^|[\s/_-])(daily|perday|per day|day pass|daypass|\/day)([\s/_-]|$)/.test(perDayKeywordSource);
  const fromFlag = Boolean(
    row?.isPerDay ??
      row?.perDay ??
      row?.daily ??
      row?.dataPerDay ??
      row?.allowance_per_day ??
      row?.dailyAllowance ??
      row?.per_day ??
      row?.is_daily,
  );

  const overrideIds = readPerDayPlanOverrides();
  const isPerDay = fromFlag || fromKeyword || overrideIds.has(id.toLowerCase());
  const unlimited =
    typeof row?.unlimited === "boolean"
      ? row.unlimited
      : typeof row?.unlimited === "string"
      ? ["1", "true", "yes", "on", "enabled"].includes(row.unlimited.trim().toLowerCase())
      : false;

  // Extract included countries from locationNetworkList or location field
  const networkList = Array.isArray(row?.locationNetworkList)
    ? row.locationNetworkList
    : Array.isArray(row?.location_network_list)
    ? row.location_network_list
    : [];
  const countriesFromNetwork: { name: string; code: string }[] = networkList
    .map((entry: any) => {
      const code = String(entry?.locationCode ?? entry?.location_code ?? entry?.code ?? "").trim().toUpperCase();
      const name = String(entry?.locationName ?? entry?.location_name ?? entry?.name ?? "").trim();
      const resolvedName = name || (code.length === 2 ? (resolveCountryName(code) || code) : "");
      return resolvedName ? { name: resolvedName, code: code.length === 2 ? code : "" } : null;
    })
    .filter(Boolean) as { name: string; code: string }[];

  const countriesFromLocationTokens: { name: string; code: string }[] = parseLocationTokens(row?.location)
    .map((code) => {
      const name = resolveCountryName(code) || code;
      return name ? { name, code } : null;
    })
    .filter(Boolean) as { name: string; code: string }[];

  const rawCountries = countriesFromNetwork.length > 0 ? countriesFromNetwork : countriesFromLocationTokens;

  // Dedupe by name
  const seenNames = new Set<string>();
  const dedupedCountries: { name: string; code: string }[] = [];
  for (const c of rawCountries) {
    if (!seenNames.has(c.name)) {
      seenNames.add(c.name);
      dedupedCountries.push(c);
    }
  }

  return {
    id,
    data,
    validity: toNumber(row?.validity ?? row?.durationDays ?? row?.duration_days ?? row?.days, 0),
    price: toNumber(row?.price ?? row?.bundle_price, 0),
    unlimited,
    isPerDay,
    dataLabel: formatDataAllowance(data, { unlimited, perDay: isPerDay }),
    includedCountries: dedupedCountries,
  };
}

function readPerDayPlanOverrides(): Set<string> {
  try {
    const raw = String(localStorage.getItem("esimPerDayPlanIds") || "").trim();
    if (!raw) {
      return new Set<string>();
    }
    return new Set(
      raw
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    );
  } catch {
    return new Set<string>();
  }
}

function isEsimAccessOffer(row: any): boolean {
  const provider = String(row?.provider || row?.providerName || row?.provider_code || row?.providerCode || "").toLowerCase();
  if (provider) {
    return provider.includes("esim_access") || provider.includes("esimaccess") || provider.includes("esim access");
  }

  const id = String(row?.id ?? row?.bundleName ?? "").toLowerCase();
  return id.startsWith("ea::");
}

function isVisibleBundleRow(row: any): boolean {
  const id = String(row?.id ?? row?.bundleName ?? row?.bundle_name ?? "").trim();
  const keywordSource = buildPerDayKeywordSource(row, id);
  return !/(^|[\s/_-])(daily|perday|per day|day pass|daypass|\/day)([\s/_-]|$)/.test(keywordSource);
}

function buildPerDayKeywordSource(row: any, id: string): string {
  return [
    id,
    row?.name,
    row?.title,
    row?.packageName,
    row?.package_name,
    row?.bundleName,
    row?.bundle_name,
    row?.description,
    row?.allowanceMode,
    row?.allowance_mode,
    row?.category,
    row?.type,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function sortDestinations(list: PlansDestination[]): PlansDestination[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

function dedupeBundlesByValidityAndData(bundles: PlansBundle[]): PlansBundle[] {
  const bestByKey = new Map<string, PlansBundle>();

  bundles.forEach((bundle) => {
    const dataKey = Math.round(bundle.data * 1024);
    const key = `${bundle.validity}:${dataKey}:${bundle.unlimited ? "u" : "f"}`;
    const current = bestByKey.get(key);

    if (!current || bundle.price < current.price) {
      bestByKey.set(key, bundle);
    }
  });

  return Array.from(bestByKey.values());
}

function readDestinationPreviewCache(code: string): { priceFrom: number; plansCount: number } | null {
  const key = String(code || "").trim().toUpperCase();
  if (!key) {
    return null;
  }
  const cached = destinationPreviewCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    destinationPreviewCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeDestinationPreviewCache(code: string, value: { priceFrom: number; plansCount: number }): void {
  const key = String(code || "").trim().toUpperCase();
  if (!key) {
    return;
  }
  destinationPreviewCache.set(key, {
    value,
    expiresAt: Date.now() + DESTINATION_PREVIEW_CACHE_TTL_MS,
  });
}

function parseLocationTokens(rawLocation: unknown): string[] {
  return String(rawLocation || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function isCountryOfferRow(row: any, destinationCode: string): boolean {
  const target = String(destinationCode || "").trim().toUpperCase();
  if (!target) {
    return false;
  }

  const locationCode = String(row?.locationCode ?? row?.location_code ?? "")
    .trim()
    .toUpperCase();

  if (locationCode && locationCode !== target) {
    return false;
  }

  const locationTokens = parseLocationTokens(row?.location);
  if (locationTokens.length > 1) {
    return false;
  }

  if (locationTokens.length === 1 && locationTokens[0] !== target) {
    return false;
  }

  const networkList = Array.isArray(row?.locationNetworkList)
    ? row.locationNetworkList
    : Array.isArray(row?.location_network_list)
    ? row.location_network_list
    : [];

  if (networkList.length > 1) {
    return false;
  }

  return Boolean(locationCode || locationTokens.length === 1);
}

function sanitizePhoneNumber(phone: string): string {
  return String(phone || "").replace(/[^\d]/g, "");
}

function normalizeDialCode(dialCode: string): string {
  const clean = String(dialCode || "").replace(/[^\d+]/g, "");
  if (!clean) {
    return "+964";
  }
  return clean.startsWith("+") ? clean : `+${clean}`;
}

export function buildFullPhoneNumber(dialCode: string, phoneNumber: string): string {
  const dial = normalizeDialCode(dialCode);
  const dialDigits = dial.replace(/[^\d]/g, "");
  let localDigits = sanitizePhoneNumber(phoneNumber);

  if (dialDigits) {
    if (localDigits.startsWith(`00${dialDigits}`)) {
      localDigits = localDigits.slice(2 + dialDigits.length);
    } else if (localDigits.startsWith(dialDigits)) {
      localDigits = localDigits.slice(dialDigits.length);
    }
  }

  const local = localDigits.replace(/^0+/, "");
  if (!local) {
    return "";
  }
  return `${dial}${local}`;
}

export function getUserAuthState(): boolean {
  return hasAuthenticatedSession();
}

export async function authenticateForCheckout(payload: {
  mode: "login" | "signup";
  dialCode: string;
  phoneNumber: string;
  fullName: string;
  password: string;
}): Promise<ApiResponse<{ userId: string; phone: string; name: string }>> {
  const fullPhoneNumber = buildFullPhoneNumber(payload.dialCode, payload.phoneNumber);

  if (!fullPhoneNumber) {
    return { success: false, error: "Please enter your phone number" };
  }

  if (payload.mode === "signup") {
    if (!payload.fullName.trim()) {
      return { success: false, error: "Please enter your full name" };
    }
    return signup(fullPhoneNumber, payload.fullName.trim(), payload.password);
  }

  return login(fullPhoneNumber, payload.password);
}

export function createCheckoutPayload(destination: PlansDestination, bundle: PlansBundle): CheckoutPayload {
  return {
    country: {
      name: destination.name,
      flag: destination.flag,
      code: destination.code,
      type: destination.type,
    },
    plan: {
      id: bundle.id,
      data: bundle.data,
      validity: bundle.validity,
      price: bundle.price,
    },
  };
}

function readPlansPageContextCache(): PlansPageContext | null {
  try {
    const raw = String(localStorage.getItem(PLANS_CONTEXT_CACHE_KEY) || "").trim();
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PlansPageContext;
    if (!parsed || !Array.isArray(parsed.countries) || !Array.isArray(parsed.regions)) {
      return null;
    }

    const cachedCountries = Array.isArray(parsed.countries)
      ? parsed.countries
          .map(normalizeDestinationRow)
          .filter((item) => item.type === "country" && String(item.code || "").trim().length > 0)
      : [];

    const cachedRegions = Array.isArray(parsed.regions)
      ? parsed.regions
          .map(normalizeDestinationRow)
          .filter((item) => item.type === "regional" && String(item.code || "").trim().length > 0)
      : [];

    return {
      countries: cachedCountries.length > 0 ? sortDestinations(cachedCountries) : FALLBACK_COUNTRIES,
      regions: cachedRegions.length > 0 ? sortDestinations(cachedRegions) : sortDestinations(FALLBACK_REGIONS),
      exchangeRate: String(parsed.exchangeRate || "1320"),
      markupPercent: String(parsed.markupPercent || "0"),
    };
  } catch {
    return null;
  }
}

function writePlansPageContextCache(context: PlansPageContext): void {
  try {
    localStorage.setItem(PLANS_CONTEXT_CACHE_KEY, JSON.stringify(context));
  } catch {
    // Ignore storage failures.
  }
}

export function getImmediatePlansPageContext(): PlansPageContext {
  const cached = readPlansPageContextCache();
  if (cached) {
    return cached;
  }

  return {
    countries: sortDestinations(FALLBACK_COUNTRIES),
    regions: sortDestinations(FALLBACK_REGIONS),
    exchangeRate: "1320",
    markupPercent: "0",
  };
}

export function getValidityFilters(plans: PlansBundle[]): number[] {
  return [...new Set(plans.map((plan) => plan.validity).filter((days) => days > 0))].sort((a, b) => a - b);
}

export function filterPlansByValidity(plans: PlansBundle[], validity: number | "all"): PlansBundle[] {
  const sorted = [...plans].sort((a, b) => {
    if (a.validity !== b.validity) {
      return a.validity - b.validity;
    }
    return a.price - b.price;
  });

  if (validity === "all") {
    return sorted;
  }

  return sorted.filter((plan) => plan.validity === validity);
}

export async function loadPlansPageContext(): Promise<PlansPageContext> {
  const cached = readPlansPageContextCache();
  const [destinationsResponse, currencyResponse] = await Promise.all([
    getAllDestinations(),
    getCurrencySettings(),
  ]);

  const normalizedDestinations =
    destinationsResponse.success && Array.isArray(destinationsResponse.data)
      ? destinationsResponse.data.map(normalizeDestinationRow)
      : [];

  const countriesFromApi = sortDestinations(
    normalizedDestinations.filter(
      (item) => item.type === "country" && String(item.code || "").trim().length > 0,
    ),
  );

  const regionsFromApi = sortDestinations(
    normalizedDestinations.filter(
      (item) => item.type === "regional" && String(item.code || "").trim().length > 0,
    ),
  );

  const context = {
    countries:
      countriesFromApi.length > 0
        ? countriesFromApi
        : cached?.countries || FALLBACK_COUNTRIES,
    regions:
      regionsFromApi.length > 0
        ? regionsFromApi
        : cached?.regions || sortDestinations(FALLBACK_REGIONS),
    exchangeRate: String(currencyResponse.data?.exchangeRate || cached?.exchangeRate || "1320"),
    markupPercent: String(currencyResponse.data?.markupPercent || cached?.markupPercent || "0"),
  };

  writePlansPageContextCache(context);
  return context;
}

export async function loadBundlesForDestination(destination: PlansDestination): Promise<PlansBundle[]> {
  const byTypeResponse =
    destination.type === "regional"
      ? await getRegionPlans(destination.code)
      : await getCountryPlans(destination.code);

  const fallbackResponse =
    byTypeResponse.success && Array.isArray(byTypeResponse.data) && byTypeResponse.data.length > 0
      ? byTypeResponse
      : await getCountryPlans(destination.code);

  const rows = fallbackResponse.success && Array.isArray(fallbackResponse.data) ? fallbackResponse.data : [];
  const destinationCode = String(destination.code || "").trim().toUpperCase();
  const countryScopedRows =
    destination.type === "country"
      ? rows.filter((row: any) => isCountryOfferRow(row, destinationCode))
      : rows;

  const esimAccessRows = countryScopedRows.filter(isEsimAccessOffer);
  const sourceRows = esimAccessRows.length > 0 ? esimAccessRows : countryScopedRows;

  const normalized = sourceRows
    .filter(isVisibleBundleRow)
    .map(normalizeBundleRow)
    .filter((bundle) => bundle.data > 0 && bundle.validity > 0 && bundle.price > 0);

  return dedupeBundlesByValidityAndData(normalized).sort((a, b) =>
    a.validity === b.validity ? a.price - b.price : a.validity - b.validity,
  );
}

async function loadCountryPreviewMetrics(countryCode: string): Promise<{ priceFrom: number; plansCount: number }> {
  const normalizedCode = String(countryCode || "").trim().toUpperCase();
  if (!normalizedCode || normalizedCode.length !== 2) {
    return { priceFrom: 0, plansCount: 0 };
  }

  const cached = readDestinationPreviewCache(normalizedCode);
  if (cached) {
    return cached;
  }

  const response = await getCountryPlans(normalizedCode);
  if (!response.success || !Array.isArray(response.data)) {
    const fallback = { priceFrom: 0, plansCount: 0 };
    writeDestinationPreviewCache(normalizedCode, fallback);
    return fallback;
  }

  const visible = response.data
    .filter((row: any) => isCountryOfferRow(row, normalizedCode))
    .filter(isVisibleBundleRow)
    .map(normalizeBundleRow)
    .filter((bundle) => !bundle.isPerDay)
    .filter((bundle) => bundle.data > 0 && bundle.validity > 0 && bundle.price > 0);

  const deduped = dedupeBundlesByValidityAndData(visible);
  const priceFrom = deduped.length > 0 ? Math.min(...deduped.map((bundle) => bundle.price)) : 0;
  const resolved = { priceFrom, plansCount: deduped.length };
  writeDestinationPreviewCache(normalizedCode, resolved);
  return resolved;
}

export function usePlansPageModel(): PlansPageModel {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const immediateContext = getImmediatePlansPageContext();
  const hasImmediateDestinations =
    immediateContext.countries.length > 0 || immediateContext.regions.length > 0;
  const [activeTab, setActiveTab] = useState<PlansTabType>("country");
  const [searchQuery, setSearchQuery] = useState("");
  const [countries, setCountries] = useState<PlansDestination[]>(immediateContext.countries);
  const [regions, setRegions] = useState<PlansDestination[]>(immediateContext.regions);
  const [popularDestinations, setPopularDestinations] = useState<PlansDestination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<PlansDestination | null>(null);
  const [bundles, setBundles] = useState<PlansBundle[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState("");
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(true);
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(immediateContext.exchangeRate);
  const [markupPercent, setMarkupPercent] = useState(immediateContext.markupPercent);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingCheckoutData, setPendingCheckoutData] = useState<CheckoutPayload | null>(null);
  const [destinationPreviewByCode, setDestinationPreviewByCode] = useState<Record<string, { priceFrom: number; plansCount: number }>>({});

  useEffect(() => {
    const loadContext = async () => {
      if (!hasImmediateDestinations) {
        setIsLoadingDestinations(true);
      }
      const context = await loadPlansPageContext();
      setCountries(context.countries);
      setRegions(context.regions);
      setExchangeRate(context.exchangeRate);
      setMarkupPercent(context.markupPercent);
      setIsLoadingDestinations(false);
    };

    void loadContext();
  }, [hasImmediateDestinations]);

  useEffect(() => {
    const loadPopularDestinations = async () => {
      const response = await getPopularDestinations();
      if (response.success && Array.isArray(response.data)) {
        setPopularDestinations(response.data.map(normalizeDestinationRow));
      }
    };

    void loadPopularDestinations();

    const handlePopularUpdated = () => void loadPopularDestinations();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void loadPopularDestinations();
    };
    window.addEventListener("tulip:popular-updated", handlePopularUpdated);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("tulip:popular-updated", handlePopularUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (countries.length === 0 && regions.length === 0) {
      return;
    }

    const requestedCode = searchParams.get("code");
    const requestedType = searchParams.get("type");
    if (!requestedCode) {
      return;
    }

    const list = requestedType === "regional" ? regions : countries;
    const found = list.find((item) => item.code.toUpperCase() === requestedCode.toUpperCase());
    if (!found) {
      return;
    }

    setActiveTab(found.type);
    setSelectedDestination(found);
  }, [countries, regions, searchParams]);

  useEffect(() => {
    const loadDestinationBundles = async () => {
      if (!selectedDestination) {
        return;
      }

      setIsLoadingBundles(true);
      const nextBundles = await loadBundlesForDestination(selectedDestination);
      setBundles(nextBundles);
      setSelectedBundleId("");
      setIsLoadingBundles(false);
    };

    void loadDestinationBundles();
  }, [selectedDestination]);

  const destinations = activeTab === "country" ? countries : regions;
  const filteredDestinations = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return destinations;
    }
    return destinations.filter((item) => item.name.toLowerCase().includes(query));
  }, [destinations, searchQuery]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || activeTab !== "country") {
      return;
    }

    const targets = filteredDestinations
      .filter((item) => item.type === "country" && String(item.code || "").trim().length === 2)
      .slice(0, 10);

    if (targets.length === 0) {
      return;
    }

    let cancelled = false;
    const loadPreviews = async () => {
      const metrics = await Promise.all(
        targets.map(async (item) => {
          const code = String(item.code || "").trim().toUpperCase();
          const resolved = item.priceFrom > 0
            ? { priceFrom: item.priceFrom, plansCount: item.plansCount || 0 }
            : await loadCountryPreviewMetrics(code);
          return { code, resolved };
        }),
      );

      if (cancelled) {
        return;
      }

      setDestinationPreviewByCode((previous) => {
        const next = { ...previous };
        metrics.forEach(({ code, resolved }) => {
          if (code) {
            next[code] = resolved;
          }
        });
        return next;
      });
    };

    void loadPreviews();
    return () => {
      cancelled = true;
    };
  }, [activeTab, filteredDestinations, searchQuery]);

  const groupedBundles = useMemo(() => {
    const sorted = [...bundles].sort((a, b) =>
      a.validity === b.validity ? a.price - b.price : a.validity - b.validity,
    );
    const groups = new Map<number, PlansBundle[]>();

    sorted.forEach((bundle) => {
      const current = groups.get(bundle.validity) || [];
      current.push(bundle);
      groups.set(bundle.validity, current);
    });

    return Array.from(groups.entries()).map(([validity, offers]) => ({ validity, offers }));
  }, [bundles]);

  const getDestinationPreview = (destination: PlansDestination): { priceFrom: number; plansCount: number } => {
    const code = String(destination.code || "").trim().toUpperCase();
    const runtime = destinationPreviewByCode[code];
    const priceFrom = destination.priceFrom > 0 ? destination.priceFrom : runtime?.priceFrom || 0;
    const plansCount = destination.plansCount > 0 ? destination.plansCount : runtime?.plansCount || 0;
    return { priceFrom, plansCount };
  };

  const handleContinue = () => {
    if (!selectedDestination || !selectedBundleId) {
      return;
    }

    const selectedBundle = bundles.find((bundle) => bundle.id === selectedBundleId);
    if (!selectedBundle) {
      toast.error("Please select a valid bundle");
      return;
    }

    const checkoutData = createCheckoutPayload(selectedDestination, selectedBundle);
    if (getUserAuthState()) {
      sessionStorage.setItem("checkoutData", JSON.stringify(checkoutData));
      navigate("/checkout", { state: checkoutData });
      return;
    }

    setPendingCheckoutData(checkoutData);
    setShowAuthModal(true);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    if (!pendingCheckoutData) {
      return;
    }

    sessionStorage.setItem("checkoutData", JSON.stringify(pendingCheckoutData));
    navigate("/checkout", { state: pendingCheckoutData });
    setPendingCheckoutData(null);
  };

  return {
    activeTab,
    searchQuery,
    countries,
    regions,
    popularDestinations,
    selectedDestination,
    bundles,
    selectedBundleId,
    isLoadingDestinations,
    isLoadingBundles,
    exchangeRate,
    markupPercent,
    showAuthModal,
    filteredDestinations,
    groupedBundles,
    getDestinationPreview,
    setActiveTab,
    setSearchQuery,
    setSelectedBundleId,
    setShowAuthModal,
    selectDestination: setSelectedDestination,
    clearSelectedDestination: () => setSelectedDestination(null),
    handleContinue,
    handleAuthSuccess,
  };
}
