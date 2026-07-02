export const ACCESS_TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';
export const AUTH_USER_KEY = 'authUser';
export const REMEMBER_ME_KEY = 'rememberMe';

/** Returns true when the user opted into persistent login. */
export function getRememberMe(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(REMEMBER_ME_KEY) === 'true';
}

/**
 * Read a token from localStorage first (persisted sessions), then sessionStorage.
 * This covers both Remember-Me and session-only users with one call.
 */
export function getStoredToken(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

/** Remove all auth token keys from both storages in one shot. */
export function clearAllAuthStorage(): void {
  if (typeof window === 'undefined') return;
  [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, AUTH_USER_KEY].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}
