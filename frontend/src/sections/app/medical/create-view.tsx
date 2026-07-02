import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
import { useParams, useRouter } from 'src/routes/hook';
import { paths } from 'src/routes/paths';
// utils
import { errorReader } from 'src/utils/error-reader';
// components
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import FormProvider from 'src/components/hook-form';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
//
import { useEmployeeQuery } from '../employees/api/use-employees-api';
import { useCreateMedicalCheckMutation } from './api/use-medical-api';
import type { MedicalCheckUpsertPayload } from './api/types';
import MedicalCheckFormFields from './components/medical-check-form-fields';
import {
  buildMedicalCheckFieldsSchema,
  type MedicalCheckFieldsValues,
} from './components/utils/medical-check-schema';

// ----------------------------------------------------------------------

const DEFAULT_VALUES: MedicalCheckFieldsValues = {
  bpSystolic: 0,
  bpDiastolic: 0,
  pulse: 0,
  saturation: 0,
  alcoholValue: 0,
  alcoholPositive: false,
  hoursWorked: 0,
  hoursRested: 0,
  conclusion: 'approved',
  note: '',
};

export default function MedicalCreateView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const router = useRouter();
  const params = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const [submitError, setSubmitError] = useState('');

  const employeeId = Number(params.employeeId);
  const employeeQuery = useEmployeeQuery(employeeId);

  const createMutation = useCreateMedicalCheckMutation();

  const methods = useForm<MedicalCheckFieldsValues>({
    resolver: yupResolver(buildMedicalCheckFieldsSchema(tx)),
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      const payload: MedicalCheckUpsertPayload = {
        employee: employeeId,
        bpSystolic: values.bpSystolic,
        bpDiastolic: values.bpDiastolic,
        pulse: values.pulse,
        saturation: values.saturation,
        alcoholValue: values.alcoholValue > 0 ? String(values.alcoholValue) : null,
        alcoholPositive: values.alcoholPositive,
        hoursWorked: String(values.hoursWorked),
        hoursRested: String(values.hoursRested),
        conclusion: values.conclusion,
        note: values.note.trim(),
      };
      await createMutation.mutateAsync(payload);
      enqueueSnackbar(tx('medical.toasts.created'));
      router.push(paths.app.medical.root);
    } catch (error) {
      setSubmitError(errorReader(error as Parameters<typeof errorReader>[0]));
    }
  });

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('medical.form.createTitle')}
        links={[
          { name: tx('common.appName'), href: paths.home },
          { name: tx('medical.title'), href: paths.app.medical.root },
          { name: tx('medical.form.createTitle') },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {employeeQuery.isLoading ? (
              <>
                <Skeleton variant="circular" width={40} height={40} />
                <Skeleton variant="text" width={160} height={20} />
              </>
            ) : (
              <>
                <Avatar
                  src={employeeQuery.data?.photo ?? undefined}
                  alt={employeeQuery.data?.fullName}
                  sx={{ width: 40, height: 40, fontWeight: 700 }}
                >
                  {employeeQuery.data?.fullName?.charAt(0).toUpperCase()}
                </Avatar>
                <Stack spacing={0.25}>
                  <Typography variant="subtitle2">
                    {employeeQuery.data?.fullName ?? `#${employeeId}`}
                  </Typography>
                  {employeeQuery.data?.specialtyName && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {employeeQuery.data.specialtyName}
                    </Typography>
                  )}
                </Stack>
              </>
            )}
          </Stack>

          <Divider />

          {!!submitError && <Alert severity="error">{submitError}</Alert>}

          <FormProvider methods={methods} onSubmit={onSubmit}>
            <Stack spacing={3}>
              <MedicalCheckFormFields />

              <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                <Button variant="outlined" color="inherit" onClick={() => router.push(paths.app.medical.root)}>
                  {tx('common.actions.cancel')}
                </Button>
                <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                  {tx('common.actions.save')}
                </LoadingButton>
              </Stack>
            </Stack>
          </FormProvider>
        </Stack>
      </Card>
    </Container>
  );
}
