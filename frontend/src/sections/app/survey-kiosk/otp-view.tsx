import { useCallback, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import { useVerifyOtpMutation } from './api/use-survey-kiosk-api';
import { OtpStep, SurveyPanel } from './components';
import { useKioskSession } from './session/use-kiosk-session';

export default function OtpView() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { session, setVerified } = useKioskSession();
  const verifyOtpMutation = useVerifyOtpMutation();
  const [otpError, setOtpError] = useState<string | null>(null);

  const { employee } = session;
  const isMatch = !!employee && String(employee.id) === employeeId;

  const handleVerify = useCallback(
    (code: string) => {
      if (!employee) return;
      verifyOtpMutation.mutate(
        { employeeId: employee.id, code, fallback: session.fallback },
        {
          onSuccess: (data) => {
            setVerified(data.kioskToken);
            navigate(paths.scanDue(employee.id));
          },
          onError: (err) => setOtpError(errorReader(err)),
        }
      );
    },
    [employee, session.fallback, verifyOtpMutation, setVerified, navigate]
  );

  if (!isMatch || !employee) {
    return <Navigate to={paths.scan} replace />;
  }
  if (!session.otpPhoneMasked) {
    return <Navigate to={paths.scanConfirm(employee.id)} replace />;
  }

  return (
    <SurveyPanel>
      <Box sx={{ minHeight: 480 }}>
        <OtpStep
          phoneMasked={session.otpPhoneMasked}
          isVerifying={verifyOtpMutation.isPending}
          errorText={otpError}
          onVerify={handleVerify}
          onBack={() => navigate(paths.scan)}
        />
      </Box>
    </SurveyPanel>
  );
}
