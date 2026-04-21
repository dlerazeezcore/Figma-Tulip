const MANUAL_COUNTRY_NAMES: Record<string, string> = {
  AN: "Netherlands Antilles",
  AX: "Aland Islands",
  BQ: "Bonaire, Sint Eustatius and Saba",
  CW: "Curacao",
  HK: "Hong Kong",
  MO: "Macao",
  PS: "Palestine",
  RE: "Reunion",
  TF: "French Southern Territories",
  TW: "Taiwan",
  XK: "Kosovo",
};

let displayNames: Intl.DisplayNames | null = null;

function getRegionDisplayNames(): Intl.DisplayNames | null {
  if (displayNames) {
    return displayNames;
  }

  try {
    if (typeof Intl !== "undefined" && "DisplayNames" in Intl) {
      displayNames = new Intl.DisplayNames(["en"], { type: "region" });
      return displayNames;
    }
  } catch {
    // Ignore and use manual fallback.
  }

  return null;
}

export function resolveCountryName(value: string): string {
  const code = String(value || "").trim().toUpperCase();
  if (code.length !== 2) {
    return "";
  }

  if (MANUAL_COUNTRY_NAMES[code]) {
    return MANUAL_COUNTRY_NAMES[code];
  }

  const names = getRegionDisplayNames();
  const fromIntl = names?.of(code);
  if (fromIntl && fromIntl.trim()) {
    return fromIntl.trim();
  }

  return "";
}

export function shouldExpandIsoName(name: string, code: string): boolean {
  const normalizedName = String(name || "").trim();
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (normalizedCode.length !== 2 || normalizedName.length !== 2) {
    return false;
  }

  return normalizedName.toUpperCase() === normalizedCode;
}
