import { useCallback, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { paths } from 'src/routes/paths';
import { LanguagePopover } from 'src/layouts/_common';
import type { KioskEmployee } from './api/types';
import { FaceIdStep, SurveyPanel } from './components';
import { useEmployeeAuth } from './session/use-employee-auth';
import { useKioskSession } from './session/use-kiosk-session';

export default function FaceIdView() {
  const navigate = useNavigate();
  const { reset, setEmployee } = useKioskSession();
  const { loading, signedIn } = useEmployeeAuth();

  // Landing on /scan by any path (auto-return, rescan, stale deep-link) always starts from
  // a clean session so the next employee never inherits a stale token/identity. But a
  // *signed-in* employee bouncing here via browser back/forward must NOT be logged out just
  // by the page mounting — they're redirected straight back to /employee below instead.
  useEffect(() => {
    if (loading || signedIn) return;
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, signedIn]);

  const handleIdentified = useCallback(
    (employee: KioskEmployee) => {
      setEmployee(employee, { fallback: false });
      navigate(paths.scanConfirm(employee.id));
    },
    [setEmployee, navigate]
  );

  if (loading) return null;
  if (signedIn) return <Navigate to={paths.employee} replace />;

  return (
    <SurveyPanel action={<LanguagePopover />}>
      <FaceIdStep
        onIdentified={handleIdentified}
        onBack={() => navigate(paths.scan)}
        onManualFallback={() => navigate(paths.scanManual)}
      />
    </SurveyPanel>
  );
}
