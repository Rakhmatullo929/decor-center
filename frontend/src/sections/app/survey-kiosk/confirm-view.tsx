import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import { LanguagePopover } from 'src/layouts/_common';
import { useRequestOtpMutation } from './api/use-survey-kiosk-api';
import { ConfirmStep, SurveyPanel } from './components';
import { useEmployeeAuth } from './session/use-employee-auth';
import { useKioskSession } from './session/use-kiosk-session';

export default function ConfirmView() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const { session, setOtpRequested } = useKioskSession();
  const { loading, signedIn } = useEmployeeAuth();
  const requestOtpMutation = useRequestOtpMutation();

  const { employee } = session;
  const isMatch = !!employee && String(employee.id) === employeeId;

  const handleSendCode = useCallback(() => {
    if (!employee) return;
    requestOtpMutation.mutate(employee.id, {
      onSuccess: (data) => {
        setOtpRequested(data.phoneMasked);
        navigate(paths.scanOtp(employee.id));
      },
      onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
    });
  }, [employee, requestOtpMutation, setOtpRequested, navigate, enqueueSnackbar]);

  // A signed-in employee (JWT already minted by verify-otp) landing here via browser
  // back/forward must never re-see the pre-login confirm step — send them to the cabinet.
  if (loading) return null;
  if (signedIn) return <Navigate to={paths.employee} replace />;
  if (!isMatch || !employee) {
    return <Navigate to={paths.scan} replace />;
  }

  return (
    <SurveyPanel action={<LanguagePopover />}>
      <ConfirmStep
        employee={employee}
        isSending={requestOtpMutation.isPending}
        onSendCode={handleSendCode}
        onRescan={() => navigate(paths.scan)}
      />
    </SurveyPanel>
  );
}
