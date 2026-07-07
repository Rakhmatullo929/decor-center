import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { EmployeeLookupItem, KioskEmployee } from './api/types';
import type { Test } from '../admin-surveys/api/types';
import {
  useDueSurveysQuery,
  useRequestOtpMutation,
  useStartSurveyMutation,
  useVerifyOtpMutation,
} from './api/use-survey-kiosk-api';
import {
  ConfirmStep,
  DueSurveysStep,
  FaceIdStep,
  ManualPickStep,
  OtpStep,
  SurveyPanel,
} from './components';

type Phase = 'scan' | 'manual' | 'confirm' | 'otp' | 'due';

export default function ScanView() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [phase, setPhase] = useState<Phase>('scan');
  const [employee, setEmployee] = useState<KioskEmployee | null>(null);
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);
  const [fallback, setFallback] = useState(false);
  const [kioskToken, setKioskToken] = useState<string | null>(null);
  const [otpPhoneMasked, setOtpPhoneMasked] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const requestOtpMutation = useRequestOtpMutation();
  const verifyOtpMutation = useVerifyOtpMutation();
  const startMutation = useStartSurveyMutation();
  const dueQuery = useDueSurveysQuery(phase === 'due' && employee ? employee.id : null, kioskToken);

  const reset = useCallback(() => {
    setPhase('scan');
    setEmployee(null);
    setFaceBlob(null);
    setFallback(false);
    setKioskToken(null);
    setOtpPhoneMasked('');
    setOtpError(null);
  }, []);

  // Shared by the primary (face) and fallback (manual) paths: send the SMS code,
  // then advance to the OTP entry screen with the masked phone from the response.
  const sendCodeFor = useCallback(
    (employeeId: number) => {
      requestOtpMutation.mutate(employeeId, {
        onSuccess: (data) => {
          setOtpPhoneMasked(data.phoneMasked);
          setOtpError(null);
          setPhase('otp');
        },
        onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
      });
    },
    [requestOtpMutation, enqueueSnackbar]
  );

  const handleIdentified = useCallback((emp: KioskEmployee, blob: Blob) => {
    setEmployee(emp);
    setFaceBlob(blob);
    setFallback(false);
    setPhase('confirm');
  }, []);

  const handleManualPick = useCallback(
    (item: EmployeeLookupItem) => {
      setEmployee({ id: item.id, fullName: item.fullName, specialtyName: '', photo: null, phoneMasked: '' });
      setFaceBlob(null);
      setFallback(true);
      sendCodeFor(item.id);
    },
    [sendCodeFor]
  );

  const handleSendCode = useCallback(() => {
    if (employee) sendCodeFor(employee.id);
  }, [employee, sendCodeFor]);

  const handleVerify = useCallback(
    (code: string) => {
      if (!employee) return;
      verifyOtpMutation.mutate(
        { employeeId: employee.id, code, fallback },
        {
          onSuccess: (data) => {
            setKioskToken(data.kioskToken);
            setPhase('due');
          },
          onError: (err) => setOtpError(errorReader(err)),
        }
      );
    },
    [employee, fallback, verifyOtpMutation]
  );

  const handlePick = useCallback(
    (test: Test) => {
      if (!employee || !kioskToken || startMutation.isPending) return;
      startMutation.mutate(
        {
          payload: {
            employee: employee.id,
            test: test.id,
            faceImage: faceBlob ? new File([faceBlob], 'frame.jpg', { type: 'image/jpeg' }) : undefined,
          },
          kioskToken,
        },
        {
          onSuccess: (data) =>
            navigate(`${paths.scan}/answer`, {
              state: { start: data, employeeName: employee.fullName, kioskToken },
            }),
          onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
        }
      );
    },
    [employee, kioskToken, faceBlob, startMutation, navigate, enqueueSnackbar]
  );

  if (phase === 'scan') {
    return (
      <FaceIdStep
        onIdentified={handleIdentified}
        onBack={reset}
        onManualFallback={() => setPhase('manual')}
      />
    );
  }

  return (
    <SurveyPanel>
      <Box sx={{ minHeight: 480 }}>
        {phase === 'manual' && <ManualPickStep onPick={handleManualPick} onBack={reset} />}

        {phase === 'confirm' && employee && (
          <ConfirmStep
            employee={employee}
            isSending={requestOtpMutation.isPending}
            onSendCode={handleSendCode}
            onRescan={reset}
          />
        )}

        {phase === 'otp' && employee && (
          <OtpStep
            phoneMasked={otpPhoneMasked}
            isVerifying={verifyOtpMutation.isPending}
            errorText={otpError}
            onVerify={handleVerify}
            onBack={reset}
          />
        )}

        {phase === 'due' && employee && (
          <DueSurveysStep
            tests={dueQuery.data ?? []}
            isLoading={dueQuery.isPending}
            employeeName={employee.fullName}
            onPick={handlePick}
            onBack={reset}
          />
        )}
      </Box>
    </SurveyPanel>
  );
}
