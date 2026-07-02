import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
// utils
import { localStorageAvailable, localStorageGetItem } from 'src/utils/storage-available';
//
import { defaultLang, allLangs } from './config-lang';
//
import translationRu from './langs/ru';
import translationUz from './langs/uz';

// ----------------------------------------------------------------------

const supportedLngs = allLangs.map((l) => l.value);
const stored = localStorageGetItem('i18nextLng', defaultLang.value) || defaultLang.value;
const lng: string = supportedLngs.includes(stored) ? stored : defaultLang.value;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translations: translationRu },
      uz: { translations: translationUz },
    },
    lng,
    fallbackLng: defaultLang.value,
    supportedLngs,
    debug: false,
    ns: ['translations'],
    defaultNS: 'translations',
    interpolation: {
      escapeValue: false,
    },
  });

function syncLanguageForApi(nextLng: string) {
  if (!localStorageAvailable()) {
    return;
  }
  const base = nextLng.split('-')[0];
  const normalized = supportedLngs.includes(base) ? base : defaultLang.value;
  localStorage.setItem('language', normalized);
}

i18n.on('initialized', () => {
  syncLanguageForApi(i18n.language);
});

i18n.on('languageChanged', (nextLng) => {
  syncLanguageForApi(nextLng);
});

export default i18n;
