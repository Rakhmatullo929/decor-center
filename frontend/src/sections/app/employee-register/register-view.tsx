import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { errorReader } from 'src/utils/error-reader';
// components
import Iconify from 'src/components/iconify';
//
import { validateInvite } from '../employees/api/employee-invites-requests';
import { useRegisterEmployeeMutation } from '../employees/api/use-employee-invites-api';
import type { ValidateInviteResponse } from '../employees/api/types';
import FaceCapture from './face-capture';

const PHONE_RE = /^\+\d{9,15}$/;

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Card sx={{ p: { xs: 3, md: 4 } }}>{children}</Card>
    </Container>
  );
}

export default function EmployeeRegisterView() {
  const { tx } = useLocales();
  const { token = '' } = useParams();

  // Plain fetch (not react-query): the shared useFetch error handler logs the user
  // out / redirects to /login on 4xx — wrong for a public, unauthenticated page.
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<ValidateInviteResponse | null>(null);

  const registerMutation = useRegisterEmployeeMutation();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [workExperience, setWorkExperience] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setValidation({ valid: false, reason: 'not_found' });
      setLoading(false);
      return undefined;
    }
    validateInvite(token)
      .then((data) => {
        if (active) {
          setValidation(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setValidation({ valid: false, reason: 'not_found' });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <CenteredCard>
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Stack>
      </CenteredCard>
    );
  }

  if (!validation?.valid) {
    const reason = validation?.reason;
    const key =
      reason === 'not_found' || reason === 'used' || reason === 'expired' ? reason : 'generic';
    return (
      <CenteredCard>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Iconify icon="solar:link-broken-bold" width={48} sx={{ color: 'error.main' }} />
          <Typography variant="h6">{tx(`employees.register.invalid.${key}`)}</Typography>
        </Stack>
      </CenteredCard>
    );
  }

  if (submitted) {
    return (
      <CenteredCard>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Iconify icon="solar:check-circle-bold" width={56} sx={{ color: 'success.main' }} />
          <Typography variant="h5">{tx('employees.register.success.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {tx('employees.register.success.body')}
          </Typography>
        </Stack>
      </CenteredCard>
    );
  }

  const handleSubmit = async () => {
    setFormError('');
    if (!fullName.trim() || !PHONE_RE.test(phone) || workExperience === '') {
      setFormError(tx('employees.validation.phoneInvalid'));
      return;
    }
    if (!photo) {
      setFormError(tx('employees.register.face.required'));
      return;
    }
    try {
      await registerMutation.mutateAsync({
        token,
        fullName: fullName.trim(),
        phone,
        workExperience: Number(workExperience),
        photo,
      });
      setSubmitted(true);
    } catch (error) {
      setFormError(errorReader(error as Parameters<typeof errorReader>[0]));
    }
  };

  return (
    <CenteredCard>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{tx('employees.register.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {tx('employees.register.subtitle')}
          </Typography>
        </Stack>

        {!!formError && <Alert severity="error">{formError}</Alert>}

        <TextField
          label={tx('employees.register.specialty')}
          value={validation.specialtyName ?? ''}
          InputProps={{ readOnly: true }}
          fullWidth
        />

        <TextField
          label={`${tx('employees.register.fullName')} *`}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          fullWidth
        />

        <TextField
          label={`${tx('employees.register.phone')} *`}
          placeholder="+998901234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          fullWidth
        />

        <TextField
          label={`${tx('employees.register.workExperience')} *`}
          type="number"
          value={workExperience}
          onChange={(e) => setWorkExperience(e.target.value)}
          InputProps={{ inputProps: { min: 0 } }}
          fullWidth
        />

        <FaceCapture value={photo} onChange={setPhoto} />

        <LoadingButton
          variant="contained"
          size="large"
          loading={registerMutation.isPending}
          onClick={handleSubmit}
        >
          {tx('employees.register.submit')}
        </LoadingButton>
      </Stack>
    </CenteredCard>
  );
}
