import { createContext, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { KioskEmployee, StartSurveyResponse } from '../api/types';
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
  kioskToken: null,
  start: null,
};

export type KioskSessionContextValue = {
  session: KioskSessionState;
  /** Captured camera frame, kept in memory only — never written to storage (see face-id-view.tsx). */
  faceBlob: Blob | null;
  setEmployee: (employee: KioskEmployee, opts?: { fallback?: boolean; faceBlob?: Blob | null }) => void;
  setOtpRequested: (phoneMasked: string) => void;
  setVerified: (kioskToken: string) => void;
  setStarted: (start: StartSurveyResponse) => void;
  reset: () => void;
};

export const KioskSessionContext = createContext<KioskSessionContextValue | null>(null);

export function KioskSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<KioskSessionState>(() => readKioskSession() ?? EMPTY_STATE);
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);

  const persist = useCallback((next: KioskSessionState) => {
    setSession(next);
    writeKioskSession(next);
  }, []);

  const setEmployee = useCallback<KioskSessionContextValue['setEmployee']>(
    (employee, opts) => {
      persist({ ...EMPTY_STATE, employee, fallback: opts?.fallback ?? false });
      setFaceBlob(opts?.faceBlob ?? null);
    },
    [persist]
  );

  const setOtpRequested = useCallback<KioskSessionContextValue['setOtpRequested']>(
    (otpPhoneMasked) => setSession((prev) => {
      const next = { ...prev, otpPhoneMasked, kioskToken: null, start: null };
      writeKioskSession(next);
      return next;
    }),
    []
  );

  const setVerified = useCallback<KioskSessionContextValue['setVerified']>(
    (kioskToken) => setSession((prev) => {
      const next = { ...prev, kioskToken, start: null };
      writeKioskSession(next);
      return next;
    }),
    []
  );

  const setStarted = useCallback<KioskSessionContextValue['setStarted']>(
    (start) => setSession((prev) => {
      const next = { ...prev, start };
      writeKioskSession(next);
      return next;
    }),
    []
  );

  const reset = useCallback(() => {
    clearKioskSession();
    setSession(EMPTY_STATE);
    setFaceBlob(null);
  }, []);

  const value = useMemo<KioskSessionContextValue>(
    () => ({ session, faceBlob, setEmployee, setOtpRequested, setVerified, setStarted, reset }),
    [session, faceBlob, setEmployee, setOtpRequested, setVerified, setStarted, reset]
  );

  return <KioskSessionContext.Provider value={value}>{children}</KioskSessionContext.Provider>;
}
