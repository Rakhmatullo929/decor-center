import { useEffect, useState } from 'react';
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
import EmptyContent from 'src/components/empty-content';
import FormProvider from 'src/components/hook-form';
import { LoadingScreen } from 'src/components/loading-screen';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
//
import { useEmployeeQuery } from '../employees/api/use-employees-api';
import { useMedicalCheckQuery, useUpdateMedicalCheckMutation } from './api/use-medical-api';
import type { MedicalCheckUpsertPayload } from './api/types';
import MedicalCheckFormFields from './components/medical-check-form-fields';
import {
  buildMedicalCheckFieldsSchema,
  type MedicalCheckFieldsValues,
} from './components/utils/medical-check-schema';

// ----------------------------------------------------------------------

export default function MedicalEditView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const router = useRouter();
  const params = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const [submitError, setSubmitError] = useState('');

  const checkQuery = useMedicalCheckQuery(params.id);
  const check = checkQuery.data;
  const isLoading = checkQuery.isPending;

  const employeeQuery = useEmployeeQuery(check?.employee ?? 0);

  const updateMutation = useUpdateMedicalCheckMutation();

  const methods = useForm<MedicalCheckFieldsValues>({
    resolver: yupResolver(buildMedicalCheckFieldsSchema(tx)),
    defaultValues: {
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
    },
    mode: 'onChange',
  });

  const { reset, handleSubmit, formState: { isSubmitting } } = methods;

  // Pre-fill form once the check is loaded.
  useEffect(() => {
    if (check) {
      reset({
        bpSystolic: check.bpSystolic,
        bpDiastolic: check.bpDiastolic,
        pulse: check.pulse,
        saturation: check.saturation,
        alcoholValue: check.alcoholValue ? Number(check.alcoholValue) : 0,
        alcoholPositive: check.alcoholPositive,
        hoursWorked: Number(check.hoursWorked),
        hoursRested: Number(check.hoursRested),
        conclusion: check.conclusion,
        note: check.note,
      });
    }
  }, [check, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!check) return;
    setSubmitError('');
    try {
      const payload: Partial<MedicalCheckUpsertPayload> = {
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
      await updateMutation.mutateAsync({ id: check.id, payload });
      enqueueSnackbar(tx('medical.toasts.updated'));
      router.push(paths.app.medical.detail(check.id));
    } catch (error) {
      setSubmitError(errorReader(error as Parameters<typeof errorReader>[0]));
    }
  });

  if (isLoading) return <LoadingScreen />;

  if (!check) {
    return (
      <EmptyContent
        title={tx('medical.detail.notFound')}
        action={
          <Button onClick={() => router.push(paths.app.medical.root)}>
            {tx('common.actions.back')}
          </Button>
        }
      />
    );
  }

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('medical.form.editTitle')}
        links={[
          { name: tx('common.appName'), href: paths.home },
          { name: tx('medical.title'), href: paths.app.medical.root },
          { name: check.employeeName, href: paths.app.medical.detail(check.id) },
          { name: tx('medical.form.editTitle') },
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
                    {employeeQuery.data?.fullName ?? check.employeeName}
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
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => router.push(paths.app.medical.detail(check.id))}
                >
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
