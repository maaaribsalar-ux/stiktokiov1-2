import { ui, defaultLang } from './ui';

export function getLangFromUrl(url: URL) {
  // Handle undefined pathname during static build
  if (!url || !url.pathname) {
    return defaultLang;
  }
  
  // Ensure pathname is a string before splitting
  const pathname = url.pathname;
  if (typeof pathname !== 'string') {
    return defaultLang;
  }
  
  const [, lang] = pathname.split('/');
  if (lang in ui) return lang as keyof typeof ui;
  return defaultLang;
}

export function useTranslations(lang: keyof typeof ui) {
  return function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang][key] || ui[defaultLang][key];
  }
}

export function getRouteFromUrl(url: URL): string | undefined {
  // Handle undefined pathname during static build
  if (!url || !url.pathname) {
    return undefined;
  }
  
  const pathname = url.pathname;
  if (typeof pathname !== 'string') {
    return undefined;
  }
  
  const parts = pathname.split('/');
  const path = parts.pop() || parts.pop();
  
  if (path === undefined) {
    return undefined;
  }
  
  const currentLang = getLangFromUrl(url);
  if (defaultLang === currentLang) {
    return path;
  }
  return path;
}