import {
  ACCESS_TOKEN_KEY,
  clearAllAuthStorage,
  getRememberMe,
} from 'src/auth/api/storage-keys';

// ----------------------------------------------------------------------

function jwtDecode(token: string) {
  const base64Url = token.split('.')[1];
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split('')
      .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join('')
  );

  return JSON.parse(jsonPayload);
}

// ----------------------------------------------------------------------

export const isValidToken = (accessToken: string) => {
  if (!accessToken) {
    return false;
  }

  const decoded = jwtDecode(accessToken);

  const currentTime = Date.now() / 1000;

  return decoded.exp > currentTime;
};

// ----------------------------------------------------------------------

/**
 * Persist or clear the access token. Expiry is handled reactively by the
 * axios response interceptor (refresh on 401), not by a setTimeout — short
 * access TTLs (minutes) made the old "schedule an alert at exp" approach
 * both noisy and unreliable across tab sleep/wake.
 *
 * When `rememberMe` is omitted the current stored preference is used so
 * callers that don't know about the flag (e.g. initialize on page load) stay
 * consistent with whatever the user chose at login time.
 */
export const setSession = (accessToken: string | null, rememberMe?: boolean) => {
  if (accessToken) {
    const storage = (rememberMe ?? getRememberMe()) ? localStorage : sessionStorage;
    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    clearAllAuthStorage();
  }
};
