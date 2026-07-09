import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { errorReader } from 'src/utils/error-reader';
import type { EmployeeLookupItem } from './api/types';
import { useRequestOtpMutation } from './api/use-survey-kiosk-api';
import { ManualPickStep, SurveyPanel } from './components';
import { useKioskSession } from './session/use-kiosk-session';

export default function ManualPickView() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { setEmployee, setOtpRequested } = useKioskSession();
  const requestOtpMutation = useRequestOtpMutation();

  const handlePick = useCallback(
    (item: EmployeeLookupItem) => {
      setEmployee(
        { id: item.id, fullName: item.fullName, specialtyName: '', photo: null, phoneMasked: '' },
        { fallback: true }
      );
      requestOtpMutation.mutate(item.id, {
        onSuccess: (data) => {
          setOtpRequested(data.phoneMasked);
          navigate(paths.scanOtp(item.id));
        },
        onError: (err) => enqueueSnackbar(errorReader(err), { variant: 'error' }),
      });
    },
    [setEmployee, setOtpRequested, requestOtpMutation, navigate, enqueueSnackbar]
  );

  return (
    <SurveyPanel>
      <Box sx={{ minHeight: 480 }}>
        <ManualPickStep onPick={handlePick} onBack={() => navigate(paths.scan)} />
      </Box>
    </SurveyPanel>
  );
}
