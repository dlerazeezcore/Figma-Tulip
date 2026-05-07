import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../i18n';
import { isAuthenticated } from '../wiring/account-service';
import { updateAuthMeProfile } from '../wiring/esim-app-client';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'IQD';
export type Language = 'en' | 'es' | 'fr' | 'ar' | 'ku';

interface UserPreferencesState {
  currency: Currency;
  language: Language;
  setCurrency: (currency: Currency) => void;
  setLanguage: (language: Language) => void;
  hydrateFromBackend: (input: { preferredLanguage?: string | null; preferredCurrency?: string | null }) => void;
}

const ALLOWED_LANGUAGES: Language[] = ['en', 'es', 'fr', 'ar', 'ku'];
const ALLOWED_CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'IQD'];

function syncToBackend(payload: { preferredLanguage?: string | null; preferredCurrency?: string | null }): void {
  if (!isAuthenticated()) {
    return;
  }
  void updateAuthMeProfile(payload).catch((error) => {
    console.warn('Failed to sync user preferences to backend:', error);
  });
}

export const useUserPreferences = create<UserPreferencesState>()(
  persist(
    (set, get) => ({
      currency: 'IQD',
      language: 'en',
      setCurrency: (currency) => {
        if (get().currency === currency) {
          return;
        }
        set({ currency });
        syncToBackend({ preferredCurrency: currency });
      },
      setLanguage: (language) => {
        if (get().language !== language) {
          i18n.changeLanguage(language);
          set({ language });
          syncToBackend({ preferredLanguage: language });
        }
      },
      hydrateFromBackend: ({ preferredLanguage, preferredCurrency }) => {
        const current = get();
        const patch: Partial<Pick<UserPreferencesState, 'language' | 'currency'>> = {};

        const normalizedLanguage = String(preferredLanguage || '').trim().toLowerCase() as Language;
        if (
          preferredLanguage
          && ALLOWED_LANGUAGES.includes(normalizedLanguage)
          && normalizedLanguage !== current.language
        ) {
          patch.language = normalizedLanguage;
          i18n.changeLanguage(normalizedLanguage);
        }

        const normalizedCurrency = String(preferredCurrency || '').trim().toUpperCase() as Currency;
        if (
          preferredCurrency
          && ALLOWED_CURRENCIES.includes(normalizedCurrency)
          && normalizedCurrency !== current.currency
        ) {
          patch.currency = normalizedCurrency;
        }

        if (Object.keys(patch).length > 0) {
          set(patch);
        }
      },
    }),
    {
      name: 'tulip-user-preferences',
    }
  )
);
