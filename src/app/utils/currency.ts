import { useUserPreferences } from '../store/user-preferences';

const exchangeRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  IQD: 1320,
};

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  IQD: 'IQD',
};

export function convertUsdToIqd(usdPrice: number, exchangeRate: number, markupPercent: number): number {
  if (!usdPrice || !exchangeRate) return 0;
  const baseIqd = usdPrice * exchangeRate;
  const withMarkup = baseIqd * (1 + markupPercent / 100);
  return Math.ceil(withMarkup / 250) * 250;
}

export function formatIqd(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function useCurrency() {
  const { currency, language } = useUserPreferences();

  const formatPrice = (priceInUSD: number) => {
    if (currency === 'IQD') {
      const converted = convertUsdToIqd(priceInUSD, 1320, 0);
      return `${formatIqd(converted)} IQD`;
    }
    
    const rate = exchangeRates[currency] || 1;
    const converted = priceInUSD * rate;
    
    return new Intl.NumberFormat(language === 'en' ? 'en-US' : language, {
      style: 'currency',
      currency: currency,
    }).format(converted);
  };

  return { formatPrice, currency };
}
