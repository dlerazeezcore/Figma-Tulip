import { format } from "date-fns";
import { enUS, ar, es, fr, ckb } from "date-fns/locale";

const locales: Record<string, any> = { en: enUS, ar, es, fr, ku: ckb };

/**
 * Formats a date string respecting the language code, with special handling for Kurdish.
 */
export function formatLocalizedDate(date: Date, langCode: string, formatType: "short" | "full" = "short") {
  if (!date) return "";

  // date-fns formatting with fallback
  if (langCode === "ku") {
    // Native Intl support handles Central Kurdish (ckb/ku) relatively well in most modern environments.
    try {
      const options: Intl.DateTimeFormatOptions = formatType === "short"
        ? { day: "numeric", month: "short" }
        : { weekday: "short", day: "numeric", month: "short" };
      return new Intl.DateTimeFormat("ku", options).format(date);
    } catch {
      // Fallback
    }
  }

  const currentLocale = locales[langCode] || enUS;
  const formatStr = formatType === "short" ? "d MMM" : "EEE, d MMM";
  return format(date, formatStr, { locale: currentLocale });
}
