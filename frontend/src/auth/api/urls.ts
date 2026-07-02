import { API_ENDPOINTS } from 'src/lib/api/endpoints';

/** Auth paths aligned with `backend/apps/accounts/urls.py`. */
export const AUTH_URLS = {
  login: API_ENDPOINTS.auth.login,
  logout: API_ENDPOINTS.auth.logout,
  refresh: API_ENDPOINTS.auth.refresh,
  me: API_ENDPOINTS.auth.me,
} as const;
