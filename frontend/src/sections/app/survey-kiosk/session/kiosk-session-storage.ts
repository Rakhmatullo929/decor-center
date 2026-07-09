import type { KioskEmployee, StartSurveyResponse } from '../api/types';

const STORAGE_KEY = 'kiosk.session.v1';

export type StoredKioskSession = {
  employee: KioskEmployee | null;
  fallback: boolean;
  otpPhoneMasked: string;
  /** True once verify-otp has logged the employee in for real (see AuthProvider). */
  verified: boolean;
  start: StartSurveyResponse | null;
};

/** Reads the persisted kiosk session. Returns null on first visit, corrupt data, or a private-mode/quota failure. */
export function readKioskSession(): StoredKioskSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredKioskSession) : null;
  } catch {
    return null;
  }
}

export function writeKioskSession(state: StoredKioskSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable (private mode / quota) — the session just won't survive a refresh.
  }
}

export function clearKioskSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
