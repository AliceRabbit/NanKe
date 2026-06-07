import { zhCN } from './zh-CN';

const catalogs = {
  'zh-CN': zhCN
} as const;

export type Locale = keyof typeof catalogs;
export type I18nKey = keyof typeof zhCN;
export type I18nParams = Record<string, string | number | boolean | null | undefined>;

export const defaultLocale: Locale = 'zh-CN';

let activeLocale: Locale = defaultLocale;

export function getLocale(): Locale {
  return activeLocale;
}

export function setLocale(locale: Locale) {
  activeLocale = locale;
}

export function t(key: I18nKey, params: I18nParams = {}): string {
  const template = catalogs[activeLocale][key] ?? catalogs[defaultLocale][key] ?? key;
  return interpolate(template, params);
}

export function interpolate(template: string, params: I18nParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? match : String(value);
  });
}
