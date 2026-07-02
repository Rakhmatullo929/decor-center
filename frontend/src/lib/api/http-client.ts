import axios, {
  AxiosError,
  AxiosRequestTransformer,
  AxiosResponseTransformer,
  InternalAxiosRequestConfig,
} from 'axios';
// eslint-disable-next-line import/no-extraneous-dependencies -- humps is a runtime dep; types are dev-only @types/humps
import humps from 'humps';

import { HOST_API } from 'src/config-global';
import { paths } from 'src/routes/paths';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  clearAllAuthStorage,
  getRememberMe,
  getStoredToken,
} from 'src/auth/api/storage-keys';

import { API_ENDPOINTS } from './endpoints';

// ----------------------------------------------------------------------

const root = String(HOST_API ?? '').replace(/\/$/, '');

function asRequestTransformers(
  value: AxiosRequestTransformer | AxiosRequestTransformer[] | undefined
): AxiosRequestTransformer[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function asResponseTransformers(
  value: AxiosResponseTransformer | AxiosResponseTransformer[] | undefined
): AxiosResponseTransformer[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function decamelizeRequestBody(data: unknown): unknown {
  if (data instanceof FormData) {
    return data;
  }
  if (data == null || typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (typeof data === 'object') {
    return humps.decamelizeKeys(data as Record<string, unknown>);
  }
  return data;
}

function camelizeResponseData(data: unknown): unknown {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data;
  }
  return humps.camelizeKeys(data as Record<string, unknown>);
}

/**
 * Axios instance for this app: `HOST_API` origin, snake_case ↔ camelCase for JSON bodies
 * and plain object query params, JWT from storage (localStorage or sessionStorage) unless `skipAuth` is set.
 */
export const apiClient = axios.create({
  baseURL: root || undefined,
  headers: {
    'Content-Type': 'application/json',
  },
  transformRequest: [decamelizeRequestBody, ...asRequestTransformers(axios.defaults.transformRequest)],
  transformResponse: [
    ...asResponseTransformers(axios.defaults.transformResponse),
    camelizeResponseData,
  ],
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const next: InternalAxiosRequestConfig = { ...config };

  if (next.data instanceof FormData && next.headers) {
    delete (next.headers as Record<string, unknown>)['Content-Type'];
  }

  const { params } = next;
  if (
    params &&
    typeof params === 'object' &&
    !(params instanceof URLSearchParams) &&
    !Array.isArray(params)
  ) {
    next.params = humps.decamelizeKeys(params as Record<string, unknown>);
  }

  if (!next.skipAuth && typeof window !== 'undefined') {
    const token = getStoredToken(ACCESS_TOKEN_KEY);
    if (token) {
      next.headers = next.headers ?? {};
      (next.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
  }

  return next;
});

// ── Transparent refresh on 401 ──────────────────────────────────────────
//
// Access tokens are short-lived (minutes). When one expires mid-session the
// API returns 401; we exchange the refresh token for a new pair and replay
// the original request once. Concurrent 401s share a single in-flight refresh
// so we don't fire N parallel refresh calls.

const REFRESH_URL = API_ENDPOINTS.auth.refresh;

let refreshPromise: Promise<string> | null = null;

function clearSessionAndRedirect() {
  if (typeof window === 'undefined') return;
  clearAllAuthStorage();
  if (window.location.pathname !== paths.auth.jwt.login) {
    window.location.href = paths.auth.jwt.login;
  }
}

async function refreshAccessToken(): Promise<string> {
  const refresh = getStoredToken(REFRESH_TOKEN_KEY);
  if (!refresh) {
    throw new Error('no_refresh_token');
  }
  // Bare axios call: bypasses our request/response interceptors so a failed
  // refresh can't loop back into another refresh attempt.
  const response = await axios.post<{ access: string; refresh?: string }>(
    `${root}${REFRESH_URL}`,
    { refresh },
    { headers: { 'Content-Type': 'application/json' } }
  );
  const newAccess = response.data.access;
  const newRefresh = response.data.refresh;
  const storage = getRememberMe() ? localStorage : sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, newAccess);
  if (newRefresh) {
    // ROTATE_REFRESH_TOKENS=True on the backend → store the rotated refresh.
    storage.setItem(REFRESH_TOKEN_KEY, newRefresh);
  }
  return newAccess;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (!axios.isAxiosError(error) || !error.response || !error.config) {
      return Promise.reject(error);
    }

    const { status } = error.response;
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const isAuthEndpoint =
      typeof originalRequest.url === 'string' &&
      (originalRequest.url.includes(REFRESH_URL) ||
        originalRequest.url.includes(API_ENDPOINTS.auth.login) ||
        originalRequest.url.includes(API_ENDPOINTS.auth.logout));

    if (status !== 401 || originalRequest._retry || originalRequest.skipAuth || isAuthEndpoint) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newAccess = await refreshPromise;
      originalRequest.headers = originalRequest.headers ?? {};
      (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;
      return await apiClient.request(originalRequest);
    } catch (refreshError) {
      clearSessionAndRedirect();
      return Promise.reject(refreshError);
    }
  }
);
