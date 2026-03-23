import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import enAdmin from './locales/en/admin.json';
import esAdmin from './locales/es/admin.json';
import enImport from './locales/en/import.json';
import esImport from './locales/es/import.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { common: enCommon, admin: enAdmin, import: enImport },
            es: { common: esCommon, admin: esAdmin, import: esImport },
        },
        defaultNS: 'common',
        fallbackLng: 'en',
        supportedLngs: ['en', 'es'],
        interpolation: { escapeValue: false },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'esl_language',
            caches: ['localStorage'],
        },
    });

export default i18n;
