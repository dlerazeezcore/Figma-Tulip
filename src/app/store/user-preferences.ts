import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../i18n';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'IQD';
export type Language = 'en' | 'es' | 'fr' | 'ar' | 'ku';

interface UserPreferencesState {
  currency: Currency;
  language: Language;
  setCurrency: (currency: Currency) => void;
  setLanguage: (language: Language) => void;
}

export const useUserPreferences = create<UserPreferencesState>()(
  persist(
    (set) => ({
      currency: 'IQD',
      language: 'en',
      setCurrency: (currency) => set({ currency }),
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
    }),
    {
      name: 'tulip-user-preferences',
    }
  )
);
