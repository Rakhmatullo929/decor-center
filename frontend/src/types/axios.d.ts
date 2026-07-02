import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * Do not send `Authorization` (e.g. login, register, refresh, public pages).
     * Prevents a stale session token from being sent on auth endpoints.
     */
    skipAuth?: boolean;
  }
}
