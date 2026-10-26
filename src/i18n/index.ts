import { useCallback } from 'react';
import { useSettings } from '@/store/settings';
import { hi } from './hi';
import { es } from './es';

/**
 * The English text itself is the key. A language dictionary only needs the strings it translates;
 * everything else falls back to English, so a missing translation can never break the UI.
 */
export interface LanguageInfo {
  code: string;
  name: string;
  native: string;
  ready: boolean;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', native: 'English', ready: true },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', ready: true },
  { code: 'es', name: 'Spanish', native: 'Español', ready: true },
];

const DICTS: Record<string, Record<string, string>> = { hi, es };

export function translate(lang: string, text: string, vars?: Record<string, string | number>): string {
  let out = (lang !== 'en' && DICTS[lang]?.[text]) || text;
  if (vars) {
    Object.keys(vars).forEach((k) => {
      out = out.split(`{${k}}`).join(String(vars[k]));
    });
  }
  return out;
}

export type TFn = (text: string, vars?: Record<string, string | number>) => string;

export function useT(): TFn {
  const lang = useSettings((s) => s.language);
  return useCallback((text: string, vars?: Record<string, string | number>) => translate(lang, text, vars), [lang]);
}

export const tNow: TFn = (text, vars) => translate(useSettings.getState().language, text, vars);
