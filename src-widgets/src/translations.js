import langEn from './i18n/en.json';
import langDe from './i18n/de.json';

// vis-2 only detects the per-language format when en, de AND ru exist,
// so every vis-2 language is listed; languages without own file fall back to English.
const translations = {
    en: langEn,
    de: langDe,
    ru: langEn,
    pt: langEn,
    nl: langEn,
    fr: langEn,
    it: langEn,
    es: langEn,
    pl: langEn,
    uk: langEn,
    'zh-cn': langEn,
    prefix: true,
};

export default translations;
