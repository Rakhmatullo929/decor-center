import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paths } from 'src/routes/paths';
import type { KioskEmployee } from './api/types';
import { FaceIdStep } from './components';
import { useKioskSession } from './session/use-kiosk-session';

export default function FaceIdView() {
  const navigate = useNavigate();
  const { reset, setEmployee } = useKioskSession();

  // Landing on /scan by any path (auto-return, rescan, browser back, stale deep-link) always
  // starts from a clean session so the next employee never inherits a stale token/identity.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIdentified = useCallback(
    (employee: KioskEmployee, faceBlob: Blob) => {
      setEmployee(employee, { fallback: false, faceBlob });
      navigate(paths.scanConfirm(employee.id));
    },
    [setEmployee, navigate]
  );

  return (
    <FaceIdStep
      onIdentified={handleIdentified}
      onBack={() => navigate(paths.scan)}
      onManualFallback={() => navigate(paths.scanManual)}
    />
  );
}
