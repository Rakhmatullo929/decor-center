import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import LoadingButton from '@mui/lab/LoadingButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import FormProvider, { RHFMultiSelect, RHFSwitch, RHFTextField } from 'src/components/hook-form';
import { useSnackbar } from 'src/components/snackbar';
import { useCreateTestMutation, useUpdateTestMutation } from '../../api/use-surveys-api';
import type { Test } from '../../api/types';
import { buildTestSchema, type TestFormValues } from './utils/test-schema';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

type Props = {
  open: boolean;
  onClose: VoidFunction;
  test?: Test | null;
  onSaved: (test: Test, mode: 'create' | 'edit') => void;
};

export default function TestUpsertDialog({ open, onClose, test, onSaved }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = Boolean(test);

  const createMutation = useCreateTestMutation();
  const updateMutation = useUpdateTestMutation();

  const defaultValues = useMemo<TestFormValues>(
    () => ({
      title: test?.title ?? '',
      isActive: test?.isActive ?? true,
      isAdminConducted: test?.isAdminConducted ?? false,
      isAfterApplication: test?.isAfterApplication ?? false,
      afterDays: test?.afterDays ?? null,
      testDaysFrom: test?.testDaysFrom ?? null,
      testDaysTo: test?.testDaysTo ?? null,
      month: (test?.month ?? []).map(String),
    }),
    [test]
  );

  const methods = useForm<TestFormValues>({
    resolver: yupResolver(buildTestSchema(tx)),
    defaultValues,
    mode: 'onChange',
  });

  const {
    reset,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const isAfterApplication = watch('isAfterApplication');

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      title: values.title,
      isActive: values.isActive,
      isAdminConducted: values.isAdminConducted,
      isAfterApplication: values.isAfterApplication,
      afterDays: values.isAfterApplication ? Number(values.afterDays) : null,
      testDaysFrom: values.isAfterApplication ? null : values.testDaysFrom ?? null,
      testDaysTo: values.isAfterApplication ? null : values.testDaysTo ?? null,
      month: values.isAfterApplication ? [] : values.month.map(Number),
    };
    const saved = isEdit
      ? await updateMutation.mutateAsync({ id: (test as Test).id, payload })
      : await createMutation.mutateAsync(payload);
    enqueueSnackbar(tx(isEdit ? 'surveys.tests.toasts.updated' : 'surveys.tests.toasts.created'));
    onSaved(saved, isEdit ? 'edit' : 'create');
    onClose();
  });

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>
          {tx(isEdit ? 'surveys.tests.form.editTitle' : 'surveys.tests.form.createTitle')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <RHFTextField name="title" label={`${tx('surveys.tests.form.title')} *`} autoFocus />
            <RHFSwitch name="isActive" label={tx('surveys.tests.form.active')} />
            <RHFSwitch name="isAdminConducted" label={tx('surveys.tests.form.adminConducted')} />

            <Divider />
            <Typography variant="subtitle2">{tx('surveys.tests.form.scheduling')}</Typography>
            <RHFSwitch name="isAfterApplication" label={tx('surveys.tests.form.afterApplication')} />

            {isAfterApplication ? (
              <RHFTextField
                name="afterDays"
                type="number"
                label={`${tx('surveys.tests.form.afterDays')} *`}
                InputProps={{ inputProps: { min: 0 } }}
              />
            ) : (
              <Stack spacing={2.5}>
                <RHFMultiSelect
                  checkbox
                  chip
                  name="month"
                  label={tx('surveys.tests.form.months')}
                  options={MONTH_OPTIONS}
                  placeholder={tx('surveys.tests.form.monthsAny')}
                />
                <Stack direction="row" spacing={2}>
                  <RHFTextField
                    name="testDaysFrom"
                    type="number"
                    label={tx('surveys.tests.form.daysFrom')}
                    InputProps={{ inputProps: { min: 1, max: 31 } }}
                  />
                  <RHFTextField
                    name="testDaysTo"
                    type="number"
                    label={tx('surveys.tests.form.daysTo')}
                    InputProps={{ inputProps: { min: 1, max: 31 } }}
                  />
                </Stack>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={onClose}>
            {tx('common.actions.cancel')}
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {tx('common.actions.save')}
          </LoadingButton>
        </DialogActions>
      </FormProvider>
    </Dialog>
  );
}
