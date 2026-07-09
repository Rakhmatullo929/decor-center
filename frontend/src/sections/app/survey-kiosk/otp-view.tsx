import { useCallback, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuthContext } from 'src/auth/hooks';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import { LanguagePopover } from 'src/layouts/_common';
import { useVerifyOtpMutation } from './api/use-survey-kiosk-api';
import { OtpStep, SurveyPanel } from './components';
import { useEmployeeAuth } from './session/use-employee-auth';
import { useKioskSession } from './session/use-kiosk-session';

export default function OtpView() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { session, setVerified } = useKioskSession();
  const { syncSessionFromApiResponse } = useAuthContext();
  const { loading, signedIn } = useEmployeeAuth();
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
            // rememberMe: false — a shared kiosk device must never persist an employee's
            // login past this tab (see kiosk-session-context.tsx's reset()).
            syncSessionFromApiResponse(data, false);
            setVerified();
            // replace: true — the OTP step must not stay in browser history once signed
            // in. No :employeeId in the URL — the cabinet reads identity from the JWT (/me).
            navigate(paths.employee, { replace: true });
          },
          onError: (err) => setOtpError(errorReader(err)),
        }
      );
    },
    [employee, session.fallback, verifyOtpMutation, syncSessionFromApiResponse, setVerified, navigate]
  );

  // A signed-in employee (JWT already minted by verify-otp) landing here via browser
  // back/forward must never re-see the pre-login OTP step — send them to the cabinet.
  if (loading) return null;
  if (signedIn) return <Navigate to={paths.employee} replace />;
  if (!isMatch || !employee) {
    return <Navigate to={paths.scan} replace />;
  }
  if (!session.otpPhoneMasked) {
    return <Navigate to={paths.scanConfirm(employee.id)} replace />;
  }

  return (
    <SurveyPanel action={<LanguagePopover />}>
      <OtpStep
        phoneMasked={session.otpPhoneMasked}
        isVerifying={verifyOtpMutation.isPending}
        errorText={otpError}
        onVerify={handleVerify}
        onBack={() => navigate(paths.scan)}
      />
    </SurveyPanel>
  );
}
