import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import { useRequestOtpMutation } from './api/use-survey-kiosk-api';
import { ConfirmStep, SurveyPanel } from './components';
import { useKioskSession } from './session/use-kiosk-session';

export default function ConfirmView() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const { session, setOtpRequested } = useKioskSession();
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

  if (!isMatch || !employee) {
    return <Navigate to={paths.scan} replace />;
  }

  return (
    <SurveyPanel>
      <Box sx={{ minHeight: 480 }}>
        <ConfirmStep
          employee={employee}
          isSending={requestOtpMutation.isPending}
          onSendCode={handleSendCode}
          onRescan={() => navigate(paths.scan)}
        />
      </Box>
    </SurveyPanel>
  );
}
