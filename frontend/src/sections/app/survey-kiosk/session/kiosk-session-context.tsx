import { createContext, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuthContext } from 'src/auth/hooks';
import type { KioskEmployee } from '../api/types';
import {
  clearKioskSession,
  readKioskSession,
  writeKioskSession,
  type StoredKioskSession,
} from './kiosk-session-storage';

export type KioskSessionState = StoredKioskSession;

const EMPTY_STATE: KioskSessionState = {
  employee: null,
  fallback: false,
  otpPhoneMasked: '',
  verified: false,
};

export type KioskSessionContextValue = {
  session: KioskSessionState;
  setEmployee: (employee: KioskEmployee, opts?: { fallback?: boolean }) => void;
  setOtpRequested: (phoneMasked: string) => void;
  /** verify-otp already logged the employee in via AuthProvider.syncSessionFromApiResponse — just flip the flag. */
  setVerified: () => void;
  reset: () => void;
};

export const KioskSessionContext = createContext<KioskSessionContextValue | null>(null);

export function KioskSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<KioskSessionState>(() => readKioskSession() ?? EMPTY_STATE);
  const { logout } = useAuthContext();

  const persist = useCallback((next: KioskSessionState) => {
    setSession(next);
    writeKioskSession(next);
  }, []);

  const setEmployee = useCallback<KioskSessionContextValue['setEmployee']>(
    (employee, opts) => {
      persist({ ...EMPTY_STATE, employee, fallback: opts?.fallback ?? false });
    },
    [persist]
  );

  const setOtpRequested = useCallback<KioskSessionContextValue['setOtpRequested']>(
    (otpPhoneMasked) => setSession((prev) => {
      const next = { ...prev, otpPhoneMasked, verified: false };
      writeKioskSession(next);
      return next;
    }),
    []
  );

  const setVerified = useCallback<KioskSessionContextValue['setVerified']>(
    () => setSession((prev) => {
      const next = { ...prev, verified: true };
      writeKioskSession(next);
      return next;
    }),
    []
  );

  const reset = useCallback(() => {
    clearKioskSession();
    setSession(EMPTY_STATE);
    // The kiosk cycles through many employees on one shared device — the previous
    // employee's JWT session (minted by verify-otp) must never leak into the next.
    logout().catch(() => {});
  }, [logout]);

  const value = useMemo<KioskSessionContextValue>(
    () => ({ session, setEmployee, setOtpRequested, setVerified, reset }),
    [session, setEmployee, setOtpRequested, setVerified, reset]
  );

  return <KioskSessionContext.Provider value={value}>{children}</KioskSessionContext.Provider>;
}
