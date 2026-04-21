import { getCurrencySettings as getBackendCurrencySettings } from "../wiring/catalog-service";

interface CurrencySettings {
  exchangeRate: string;
  markupPercent: string;
}

export async function getCurrencySettings(): Promise<CurrencySettings> {
  try {
    const response = await getBackendCurrencySettings();
    if (response.success && response.data) {
      return {
        exchangeRate: String(response.data.exchangeRate || "1320"),
        markupPercent: String(response.data.markupPercent || "0"),
      };
    }
  } catch (error) {
    console.error("Failed to fetch currency settings:", error);
  }

  return {
    exchangeRate: "1320",
    markupPercent: "0",
  };
}

export function convertUsdToIqd(usdPrice: number, exchangeRate: string, markupPercent: string): number {
  const rate = parseFloat(exchangeRate) || 1320;
  const markup = parseFloat(markupPercent) || 0;
  const priceWithMarkup = usdPrice * (1 + markup / 100);
  const iqdPrice = priceWithMarkup * rate;
  return Math.round(iqdPrice);
}

export function formatIqd(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export async function formatPrice(usdPrice: number): Promise<string> {
  const settings = await getCurrencySettings();
  const iqdPrice = convertUsdToIqd(usdPrice, settings.exchangeRate, settings.markupPercent);
  return `${formatIqd(iqdPrice)} IQD`;
}
