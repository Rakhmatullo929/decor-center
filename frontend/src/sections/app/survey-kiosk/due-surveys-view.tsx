import { useCallback, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { Test } from '../admin-surveys/api/types';
import { useDueSurveysQuery, useStartSurveyMutation } from './api/use-survey-kiosk-api';
import { DueSurveysStep, RescanDialog, SurveyPanel } from './components';
import { useKioskSession } from './session/use-kiosk-session';

export default function DueSurveysView() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const { session, faceBlob, setFaceBlob, setStarted } = useKioskSession();
  const startMutation = useStartSurveyMutation();
  const [pendingTest, setPendingTest] = useState<Test | null>(null);

  const { employee } = session;
  const isMatch = !!employee && String(employee.id) === employeeId;
  const dueQuery = useDueSurveysQuery(employee?.id ?? null, session.verified);

  // The employee is already authenticated (JWT from OTP) — browsing/refreshing this
  // list never needs the camera. A face frame is only required at the moment of actually
  // starting a specific survey (backend liveness check, unless fallback=true), so that's the
  // one place a missing frame (e.g. lost to a refresh) is handled — via the rescan dialog below.
  const startSurveyWith = useCallback(
    (test: Test, blob: Blob | null) => {
      if (!employee || !session.verified || startMutation.isPending) return;
      startMutation.mutate(
        {
          payload: {
            employee: employee.id,
            test: test.id,
            faceImage: blob ? new File([blob], 'frame.jpg', { type: 'image/jpeg' }) : undefined,
          },
        },
        {
          onSuccess: (data) => {
            setStarted(data);
            navigate(paths.scanAnswer);
          },
          onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
        }
      );
    },
    [employee, session.verified, startMutation, setStarted, navigate, enqueueSnackbar]
  );

  const handlePick = useCallback(
    (test: Test) => {
      if (!session.fallback && !faceBlob) {
        setPendingTest(test);
        return;
      }
      startSurveyWith(test, faceBlob);
    },
    [session.fallback, faceBlob, startSurveyWith]
  );

  const handleRescanCaptured = useCallback(
    (blob: Blob) => {
      setFaceBlob(blob);
      const test = pendingTest;
      setPendingTest(null);
      if (test) startSurveyWith(test, blob);
    },
    [pendingTest, setFaceBlob, startSurveyWith]
  );

  if (!isMatch || !employee) {
    return <Navigate to={paths.scan} replace />;
  }
  if (!session.verified) {
    return (
      <Navigate
        to={session.otpPhoneMasked ? paths.scanOtp(employee.id) : paths.scanConfirm(employee.id)}
        replace
      />
    );
  }

  return (
    <SurveyPanel>
      <Box sx={{ minHeight: 480 }}>
        <DueSurveysStep
          tests={dueQuery.data ?? []}
          isLoading={dueQuery.isPending}
          employeeName={employee.fullName}
          onPick={handlePick}
          onBack={() => navigate(paths.scan)}
        />
      </Box>
      <RescanDialog
        open={!!pendingTest}
        onCaptured={handleRescanCaptured}
        onCancel={() => setPendingTest(null)}
      />
    </SurveyPanel>
  );
}
