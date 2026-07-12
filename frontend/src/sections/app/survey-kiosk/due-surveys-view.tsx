import { useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'src/components/snackbar';
import useLocales from 'src/locales/use-locales';
import { paths } from 'src/routes/paths';
import { errorCode, errorReader } from 'src/utils/error-reader';
import type { Test } from '../admin-surveys/api/types';
import type { SurveySession } from './api/types';
import {
  useDueSurveysQuery,
  useInProgressSessionsQuery,
  useStartSurveyMutation,
} from './api/use-survey-kiosk-api';
import { DueSurveysStep, EmployeeTopbar, SurveyPanel } from './components';
import { useEmployeeAuth } from './session/use-employee-auth';

export default function DueSurveysView() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { tx } = useLocales();
  const { loading, signedIn, employeeId, employeeName } = useEmployeeAuth();
  const startMutation = useStartSurveyMutation();

  const dueQuery = useDueSurveysQuery(employeeId, employeeId !== null);
  const inProgressQuery = useInProgressSessionsQuery(employeeId);

  // Face-ID was already verified once, at kiosk entry (identify + OTP) — starting an
  // individual test relies on that JWT session, no camera frame is sent here.
  const handlePick = useCallback(
    (test: Test) => {
      if (employeeId === null || startMutation.isPending) return;
      startMutation.mutate(
        { payload: { employee: employeeId, test: test.id } },
        {
          onSuccess: (data) => navigate(paths.survey(data.session.id)),
          onError: (err) => {
            if (errorCode(err) === 'survey_expired') {
              enqueueSnackbar(tx('survey.kiosk.form.expired'), { variant: 'warning' });
              dueQuery.refetch();
              inProgressQuery.refetch();
              return;
            }
            enqueueSnackbar(errorReader(err), { variant: 'error' });
          },
        }
      );
    },
    [employeeId, startMutation, navigate, enqueueSnackbar, tx, dueQuery, inProgressQuery]
  );

  const handleContinue = useCallback(
    (session: SurveySession) => navigate(paths.survey(session.id)),
    [navigate]
  );

  // Wait for AuthProvider.initialize() to resolve /me before deciding — otherwise a
  // page refresh would bounce a still-valid employee session back to /scan.
  if (loading) return null;
  if (!signedIn || employeeId === null) {
    return <Navigate to={paths.scan} replace />;
  }

  return (
    <SurveyPanel action={<EmployeeTopbar />} maxWidth={640}>
      <DueSurveysStep
        tests={dueQuery.data ?? []}
        inProgressSessions={inProgressQuery.data ?? []}
        isLoading={dueQuery.isPending}
        employeeName={employeeName}
        onPick={handlePick}
        onContinue={handleContinue}
      />
    </SurveyPanel>
  );
}
