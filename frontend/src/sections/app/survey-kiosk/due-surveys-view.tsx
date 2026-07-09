import { useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { Test } from '../admin-surveys/api/types';
import { useDueSurveysQuery, useStartSurveyMutation } from './api/use-survey-kiosk-api';
import { DueSurveysStep, EmployeeTopbar, RescanDialog, SurveyPanel } from './components';
import { useEmployeeAuth } from './session/use-employee-auth';
import { useKioskSession } from './session/use-kiosk-session';

export default function DueSurveysView() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { loading, signedIn, employeeId, employeeName } = useEmployeeAuth();
  const { session, faceBlob, setFaceBlob, setStarted, reset } = useKioskSession();
  const startMutation = useStartSurveyMutation();
  const [pendingTest, setPendingTest] = useState<Test | null>(null);

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

  // "Back" here means leaving the cabinet for the next person on a shared kiosk — it must
  // sign the employee out first (like the AccountPopover logout / answer-view finish()),
  // otherwise the /scan guard would just bounce straight back to /employee.
  const handleLeave = useCallback(() => {
    reset();
    navigate(paths.scan);
  }, [reset, navigate]);

  // Wait for AuthProvider.initialize() to resolve /me before deciding — otherwise a
  // page refresh would bounce a still-valid employee session back to /scan.
  if (loading) return null;
  if (!signedIn || employeeId === null) {
    return <Navigate to={paths.scan} replace />;
  }

  return (
    <SurveyPanel action={<EmployeeTopbar />}>
      <Box sx={{ minHeight: 480 }}>
        <DueSurveysStep
          tests={dueQuery.data ?? []}
          isLoading={dueQuery.isPending}
          employeeName={employeeName}
          onPick={handlePick}
          onBack={handleLeave}
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
