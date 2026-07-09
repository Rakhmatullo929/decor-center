import { useContext } from 'react';
import { KioskSessionContext } from './kiosk-session-context';

export function useKioskSession() {
  const ctx = useContext(KioskSessionContext);
  if (!ctx) throw new Error('useKioskSession must be used within a KioskSessionProvider');
  return ctx;
}
