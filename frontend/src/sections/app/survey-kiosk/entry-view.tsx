import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { Employee } from '../employees/api/types';
import type { Test } from '../admin-surveys/api/types';
import { useDueSurveysQuery, useStartSurveyMutation } from './api/use-survey-kiosk-api';
import { DueSurveysStep, EmployeeStep, FaceIdStep, SurveyPanel } from './components';

type Phase = 'employee' | 'faceId' | 'due';

export default function KioskEntryView() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [phase, setPhase] = useState<Phase>('employee');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [faceBlob, setFaceBlob] = useState<Blob | null>(null);

  const dueQuery = useDueSurveysQuery(phase === 'due' && employee ? employee.id : null);
  const startMutation = useStartSurveyMutation();

  const handleEmployeeSelect = useCallback((emp: Employee) => {
    setEmployee(emp);
    setPhase('faceId');
  }, []);

  const handleIdentified = useCallback((emp: Employee, blob: Blob) => {
    setEmployee(emp);
    setFaceBlob(blob);
    setPhase('due');
  }, []);

  const handlePick = useCallback(
    (test: Test) => {
      if (!employee || !faceBlob || startMutation.isPending) return;
      startMutation.mutate(
        {
          employee: employee.id,
          test: test.id,
          faceImage: new File([faceBlob], 'frame.jpg', { type: 'image/jpeg' }),
        },
        {
          onSuccess: (data) => {
            navigate(paths.app.kiosk.answer, {
              state: { start: data, employeeName: employee.fullName },
            });
          },
          onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
        }
      );
    },
    [employee, faceBlob, startMutation, navigate, enqueueSnackbar]
  );

  if (phase === 'faceId') {
    return <FaceIdStep onIdentified={handleIdentified} onBack={() => setPhase('employee')} />;
  }

  return (
    <SurveyPanel>
      <Box sx={{ minHeight: 480 }}>
        {phase === 'employee' && <EmployeeStep onSelect={handleEmployeeSelect} />}
        {phase === 'due' && (
          <DueSurveysStep
            tests={dueQuery.data ?? []}
            isLoading={dueQuery.isPending}
            employeeName={employee?.fullName ?? ''}
            onPick={handlePick}
            onBack={() => setPhase('employee')}
          />
        )}
      </Box>
    </SurveyPanel>
  );
}
