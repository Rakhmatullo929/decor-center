import { useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import { LanguagePopover } from 'src/layouts/_common';
import type { EmployeeLookupItem } from './api/types';
import { useRequestOtpMutation } from './api/use-survey-kiosk-api';
import { ManualPickStep, SurveyPanel } from './components';
import { useEmployeeAuth } from './session/use-employee-auth';
import { useKioskSession } from './session/use-kiosk-session';

export default function ManualPickView() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { setEmployee, setOtpRequested } = useKioskSession();
  const { loading, signedIn } = useEmployeeAuth();
  const requestOtpMutation = useRequestOtpMutation();

  const handlePick = useCallback(
    (item: EmployeeLookupItem) => {
      setEmployee(
        { id: item.id, fullName: item.fullName, specialtyName: '', photo: null, phoneMasked: '' },
        { fallback: true }
      );
      requestOtpMutation.mutate(item.id, {
        onSuccess: (data) => {
          setOtpRequested(data.phoneMasked);
          navigate(paths.scanOtp(item.id));
        },
        onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
      });
    },
    [setEmployee, setOtpRequested, requestOtpMutation, navigate, enqueueSnackbar]
  );

  if (loading) return null;
  if (signedIn) return <Navigate to={paths.employee} replace />;

  return (
    <SurveyPanel action={<LanguagePopover />} maxWidth={480}>
      <ManualPickStep onPick={handlePick} onBack={() => navigate(paths.scan)} />
    </SurveyPanel>
  );
}
