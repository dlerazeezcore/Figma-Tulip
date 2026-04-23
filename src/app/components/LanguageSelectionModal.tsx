import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Check, X } from "lucide-react";
import { Button } from "./ui/button";

import { useUserPreferences } from "../store/user-preferences";

const LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'ku', name: 'کوردی', dir: 'rtl' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
];

export function LanguageSelectionModal() {
  const { t, i18n } = useTranslation();
  const { setLanguage } = useUserPreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState(i18n.language || 'en');

  useEffect(() => {
    const hasSelectedLanguage = localStorage.getItem('has_selected_language');
    if (!hasSelectedLanguage) {
      setIsOpen(true);
    }
  }, []);

  const handleSelect = (code: string) => {
    setSelectedLang(code);
  };

  const handleConfirm = () => {
    setLanguage(selectedLang as any);
    const langObj = LANGUAGES.find(l => l.code === selectedLang);
    if (langObj) {
      document.documentElement.dir = langObj.dir;
      document.documentElement.lang = langObj.code;
    }
    localStorage.setItem('has_selected_language', 'true');
    setIsOpen(false);
  };

  const currentDir = LANGUAGES.find(l => l.code === selectedLang)?.dir || 'ltr';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
      />

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-sm bg-white dark:bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-8 duration-300"
        dir={currentDir}
      >
        <div className="px-6 pt-8 pb-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl flex items-center justify-center mb-5 shadow-inner border border-blue-100/50 dark:border-blue-800/30">
            <Globe className="w-8 h-8 text-primary" strokeWidth={1.5} />
          </div>
          
          <h2 className="text-xl font-bold text-gray-900 dark:text-foreground mb-2 text-center tracking-tight">
            Select Language
          </h2>
          <p className="text-sm text-gray-500 dark:text-muted-foreground text-center mb-6 max-w-[260px]">
            Please choose your preferred language to continue.
          </p>

          <div className="w-full space-y-2.5 max-h-[40vh] overflow-y-auto px-1 py-1">
            {LANGUAGES.map((lang) => {
              const isSelected = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className={`
                    w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all text-start
                    ${isSelected 
                      ? 'border-primary bg-blue-50/50 dark:bg-blue-900/10 shadow-sm' 
                      : 'border-transparent bg-gray-50 dark:bg-muted hover:bg-gray-100 dark:hover:bg-accent'
                    }
                  `}
                >
                  <span className={`text-base ${isSelected ? 'font-semibold text-primary' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                    {lang.name}
                  </span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="w-full mt-6">
            <Button 
              onClick={handleConfirm}
              className="w-full h-14 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg active:scale-95 transition-all text-lg"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
