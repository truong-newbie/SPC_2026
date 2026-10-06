'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'vi' | 'en';

interface LanguageContextType {
    lang: Language;
    isVi: boolean;
    setLang: (lang: Language) => void;
    toggleLang: () => void;
    t: (vi: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
    lang: 'vi',
    isVi: true,
    setLang: () => {},
    toggleLang: () => {},
    t: (vi: string, en: string) => vi,
});

const STORAGE_KEY = 'filebridge_lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Language>('vi');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY) as Language;
            if (saved === 'vi' || saved === 'en') {
                setLangState(saved);
            }
        }
    }, []);

    const setLang = (newLang: Language) => {
        setLangState(newLang);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_KEY, newLang);
            } catch {
                // Ignore localStorage errors
            }
        }
    };

    const toggleLang = () => {
        const next = lang === 'vi' ? 'en' : 'vi';
        setLang(next);
    };

    const isVi = lang === 'vi';
    const t = (vi: string, en: string) => (isVi ? vi : en);

    return (
        <LanguageContext.Provider value={{ lang, isVi, setLang, toggleLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}

