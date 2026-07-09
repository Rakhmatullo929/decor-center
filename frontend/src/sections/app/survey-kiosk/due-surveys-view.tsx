import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { Test } from '../admin-surveys/api/types';
import { useDueSurveysQuery, useStartSurveyMutation } from './api/use-survey-kiosk-api';
import { DueSurveysStep, SurveyPanel } from './components';
import { useKioskSession } from './session/use-kiosk-session';

export default function DueSurveysView() {
  const navigate = useNavigate();
  const { employeeId } = useParams<{ employeeId: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const { session, faceBlob, setStarted } = useKioskSession();
  const startMutation = useStartSurveyMutation();

  const { employee } = session;
  const isMatch = !!employee && String(employee.id) === employeeId;
  const dueQuery = useDueSurveysQuery(employee?.id ?? null, session.kioskToken);

  const handlePick = useCallback(
    (test: Test) => {
      if (!employee || !session.kioskToken || startMutation.isPending) return;
      startMutation.mutate(
        {
          payload: {
            employee: employee.id,
            test: test.id,
            faceImage: faceBlob ? new File([faceBlob], 'frame.jpg', { type: 'image/jpeg' }) : undefined,
          },
          kioskToken: session.kioskToken,
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
    [employee, session.kioskToken, faceBlob, startMutation, setStarted, navigate, enqueueSnackbar]
  );

  if (!isMatch || !employee) {
    return <Navigate to={paths.scan} replace />;
  }
  if (!session.kioskToken) {
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
    </SurveyPanel>
  );
}
