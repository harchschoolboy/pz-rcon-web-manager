import React from 'react';
import { useI18n } from '../../i18n';
import { Locale } from '../../i18n/locales';

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useI18n();

  const languages: { code: Locale; label: string }[] = [
    { code: 'uk', label: 'UK' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <div className="flex bg-gray-700 rounded-lg p-0.5">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLocale(lang.code)}
          className={`px-2 py-1 rounded text-xs font-medium transition ${
            locale === lang.code
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};
