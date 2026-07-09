import { useAuthContext } from 'src/auth/hooks';
import type { DecorUser } from 'src/auth/api/types';

/**
 * The kiosk's only source of "am I a signed-in employee" — derived from the real JWT
 * session (/me), never from the pre-login kiosk-session or the URL.
 *
 * Used both to drive the employee cabinet (due-surveys-view.tsx) and to bounce a
 * signed-in employee away from the face+OTP steps: once verify-otp has minted a JWT,
 * browser back/forward must never be able to re-show /scan, /scan/manual,
 * /scan/confirm/:id or /scan/otp/:id — it should land back on /employee instead.
 */
export function useEmployeeAuth() {
  const { authenticated, user, loading } = useAuthContext();
  const employee =
    authenticated && (user as DecorUser | null)?.role === 'employee' ? (user as DecorUser) : null;

  return {
    loading,
    signedIn: employee !== null,
    employeeId: employee?.employeeId ?? null,
    employeeName: employee?.firstName || employee?.username || '',
  };
}
