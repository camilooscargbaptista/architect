import { en } from './locales/en.js';
import { ptBR, AppTranslation } from './locales/pt-BR.js';

type Locale = 'en' | 'pt-BR';

class I18nEngine {
  private currentLocale: Locale = 'en';

  setLocale(locale: Locale) {
    if (locale === 'en' || locale === 'pt-BR') {
      this.currentLocale = locale;
    } else {
      this.currentLocale = 'en';
    }
  }

  getLocale(): Locale {
    return this.currentLocale;
  }

  private getDict(): AppTranslation {
    return this.currentLocale === 'pt-BR' ? ptBR : en;
  }

  /**
   * Obtém uma string de tradução navegando pela dot notation da AppTranslation.
   * Exemplo: t('agents.backend.title', { lang: 'TypeScript' })
   */
  t(path: string, params?: Record<string, string | number>): string {
    const keys = path.split('.');
    let current: any = this.getDict();

    for (const key of keys) {
      if (current[key] === undefined) {
        // Fallback to EN if missing in current dict
        let fallback: any = en;
        for (const fKey of keys) {
          if (fallback[fKey] === undefined) return `[Missing translation: ${path}]`;
          fallback = fallback[fKey];
        }
        current = fallback;
        break;
      }
      current = current[key];
    }

    if (typeof current !== 'string') {
      return `[Invalid translation path: ${path}]`;
    }

    let text = current as string;
    
    // Replace params: {fw} -> value
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`{${key}}`, 'g'), String(value));
      }
    }

    return text;
  }
}

export const i18n = new I18nEngine();
