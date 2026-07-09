import { useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useAuthContext } from 'src/auth/hooks';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { DecorUser } from 'src/auth/api/types';
import type { Test } from '../admin-surveys/api/types';
import { useDueSurveysQuery, useStartSurveyMutation } from './api/use-survey-kiosk-api';
import { DueSurveysStep, RescanDialog, SurveyPanel } from './components';
import { useKioskSession } from './session/use-kiosk-session';

export default function DueSurveysView() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user, authenticated, loading } = useAuthContext();
  const { session, faceBlob, setFaceBlob, setStarted } = useKioskSession();
  const startMutation = useStartSurveyMutation();
  const [pendingTest, setPendingTest] = useState<Test | null>(null);

  // Identity comes solely from the authenticated JWT (issued by verify-otp) via /me —
  // never from the URL or the pre-login kiosk session — so a shared/bookmarked link
  // can never show or submit surveys for the wrong employee.
  const employee = user && (user as DecorUser).role === 'employee' ? (user as DecorUser) : null;
  const employeeId = employee?.employeeId ?? null;
  const employeeName = employee?.firstName || employee?.username || '';

  const dueQuery = useDueSurveysQuery(employeeId, employeeId !== null);

  // The employee is already authenticated (JWT from OTP) — browsing/refreshing this
  // list never needs the camera. A face frame is only required at the moment of actually
  // starting a specific survey (backend liveness check, unless fallback=true), so that's the
  // one place a missing frame (e.g. lost to a refresh) is handled — via the rescan dialog below.
  const startSurveyWith = useCallback(
    (test: Test, blob: Blob | null) => {
      if (employeeId === null || startMutation.isPending) return;
      startMutation.mutate(
        {
          payload: {
            employee: employeeId,
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
    [employeeId, startMutation, setStarted, navigate, enqueueSnackbar]
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

  // Wait for AuthProvider.initialize() to resolve /me before deciding — otherwise a
  // page refresh would bounce a still-valid employee session back to /scan.
  if (loading) return null;
  if (!authenticated || !employee || employeeId === null) {
    return <Navigate to={paths.scan} replace />;
  }

  return (
    <SurveyPanel>
      <Box sx={{ minHeight: 480 }}>
        <DueSurveysStep
          tests={dueQuery.data ?? []}
          isLoading={dueQuery.isPending}
          employeeName={employeeName}
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
