import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Locale, locales } from './locales';

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'en',
      
      setLocale: (locale: Locale) => {
        set({ locale });
      },
      
      t: (key: string, params?: Record<string, string | number>) => {
        const { locale } = get();
        let text = locales[locale][key] || locales['en'][key] || key;
        
        // Replace parameters like {name} with actual values
        if (params) {
          Object.entries(params).forEach(([param, value]) => {
            text = text.replace(`{${param}}`, String(value));
          });
        }
        
        return text;
      },
    }),
    {
      name: 'pz-webadmin-locale',
      partialize: (state) => ({ locale: state.locale }),
    }
  )
);
