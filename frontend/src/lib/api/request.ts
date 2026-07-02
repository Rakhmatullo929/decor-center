import type { AxiosRequestConfig } from 'axios';

import { apiClient } from './http-client';

// ----------------------------------------------------------------------

type RequestConfig = AxiosRequestConfig & { skipAuth?: boolean };

const SUPPORTED_API_LANG = new Set(['uz', 'ru']);

/** Map localStorage / i18next values to backend `lang` (uz | ru). */
function pickApiLang(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const base = raw.split('-')[0].toLowerCase();
  return SUPPORTED_API_LANG.has(base) ? base : null;
}

function resolveDefaultLang(): string {
  if (typeof localStorage !== 'undefined') {
    const fromI18n = pickApiLang(localStorage.getItem('i18nextLng'));
    if (fromI18n) {
      return fromI18n;
    }
    const fromLegacy = pickApiLang(localStorage.getItem('language'));
    if (fromLegacy) {
      return fromLegacy;
    }
  }
  const env = process.env.REACT_APP_DEFAULT_API_LANG;
  if (env && SUPPORTED_API_LANG.has(env)) {
    return env;
  }
  return 'uz';
}

/**
 * Typed helper around `apiClient`: merges `lang` into query params and returns `response.data` only.
 * Use `isPublic: true` for unauthenticated calls (same as `skipAuth: true` on the config).
 */
export async function request<T = unknown>(options: RequestConfig, isPublic = false): Promise<T> {
  const lang = resolveDefaultLang();

  let params: AxiosRequestConfig['params'];

  if (options.params instanceof URLSearchParams) {
    const next = new URLSearchParams(options.params.toString());
    next.set('lang', lang);
    params = next;
  } else {
    params = {
      ...((options.params as Record<string, unknown>) ?? {}),
      lang,
    };
  }

  const { data } = await apiClient.request<T>({
    ...options,
    params,
    skipAuth: isPublic || options.skipAuth,
  });

  return data;
}
