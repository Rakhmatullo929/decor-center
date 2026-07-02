import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
// hooks
import { useDebounce } from 'src/hooks/use-debounce';
import useLocales from 'src/locales/use-locales';
// utils
import { errorReader } from 'src/utils/error-reader';
// components
import FormProvider, {
  RHFAutocomplete,
  RHFRadioGroup,
  RHFSwitch,
  RHFTextField,
} from 'src/components/hook-form';
import { useSnackbar } from 'src/components/snackbar';
//
import { useEmployeesQuery } from '../../employees/api/use-employees-api';
import { useCreateMedicalCheckMutation, useUpdateMedicalCheckMutation } from '../api/use-medical-api';
import type { MedicalCheck, MedicalCheckUpsertPayload } from '../api/types';
import {
  buildMedicalCheckSchema,
  type EmployeeOption,
  type MedicalCheckFormValues,
} from './utils/medical-check-schema';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  /** Edit mode (admin-only PATCH, SRS §7.3) when a record is passed. */
  check?: MedicalCheck | null;
  onSaved: (check: MedicalCheck, mode: 'create' | 'edit') => void;
};

export default function MedicalCheckUpsertDialog({ open, onClose, check, onSaved }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const [submitError, setSubmitError] = useState('');

  const isEdit = Boolean(check);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const debouncedEmployeeSearch = useDebounce(employeeSearch, 400);

  // Archived employees are excluded from the medical journal lists (SRS §3.4).
  const employeesQuery = useEmployeesQuery({
    pageSize: 20,
    isActive: true,
    ...(debouncedEmployeeSearch ? { search: debouncedEmployeeSearch } : {}),
  });

  const employeeOptions = useMemo<EmployeeOption[]>(() => {
    const results: EmployeeOption[] = employeesQuery.data?.results ?? [];
    // On edit the saved employee may be missing from the first page — keep it selectable.
    if (check && !results.some((option) => option.id === check.employee)) {
      return [{ id: check.employee, fullName: check.employeeName }, ...results];
    }
    return results;
  }, [check, employeesQuery.data]);

  const createMutation = useCreateMedicalCheckMutation();
  const updateMutation = useUpdateMedicalCheckMutation();

  const defaultValues = useMemo<MedicalCheckFormValues>(
    () => ({
      employee: check ? { id: check.employee, fullName: check.employeeName } : null,
      bpSystolic: check?.bpSystolic ?? 0,
      bpDiastolic: check?.bpDiastolic ?? 0,
      pulse: check?.pulse ?? 0,
      saturation: check?.saturation ?? 0,
      alcoholValue: check?.alcoholValue ? Number(check.alcoholValue) : 0,
      alcoholPositive: check?.alcoholPositive ?? false,
      hoursWorked: check ? Number(check.hoursWorked) : 0,
      hoursRested: check ? Number(check.hoursRested) : 0,
      conclusion: check?.conclusion ?? 'approved',
      note: check?.note ?? '',
    }),
    [check]
  );

  const methods = useForm<MedicalCheckFormValues>({
    resolver: yupResolver(buildMedicalCheckSchema(tx)),
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
    if (open) {
      setSubmitError('');
      setEmployeeSearch('');
      reset(defaultValues);
    }
  }, [open, defaultValues, reset]);

  const [bpSystolic, bpDiastolic, pulse, saturation, alcoholPositive] = watch([
    'bpSystolic',
    'bpDiastolic',
    'pulse',
    'saturation',
    'alcoholPositive',
  ]);

  // SRS §7.5: non-blocking visual warning — the medic still decides.
  const showRiskWarning =
    alcoholPositive ||
    (saturation > 0 && saturation < 92) ||
    (pulse > 0 && (pulse < 50 || pulse > 110)) ||
    bpSystolic > 140 ||
    bpDiastolic > 90;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      const payload: MedicalCheckUpsertPayload = {
        employee: (values.employee as EmployeeOption).id,
        bpSystolic: values.bpSystolic,
        bpDiastolic: values.bpDiastolic,
        pulse: values.pulse,
        saturation: values.saturation,
        // The number input renders 0 as empty, so 0 means "not measured" → null.
        alcoholValue: values.alcoholValue > 0 ? String(values.alcoholValue) : null,
        alcoholPositive: values.alcoholPositive,
        hoursWorked: String(values.hoursWorked),
        hoursRested: String(values.hoursRested),
        conclusion: values.conclusion,
        note: values.note.trim(),
      };

      const saved = isEdit
        ? await updateMutation.mutateAsync({ id: (check as MedicalCheck).id, payload })
        : await createMutation.mutateAsync(payload);

      enqueueSnackbar(tx(isEdit ? 'medical.toasts.updated' : 'medical.toasts.created'));
      onSaved(saved, isEdit ? 'edit' : 'create');
      onClose();
    } catch (error) {
      setSubmitError(errorReader(error as Parameters<typeof errorReader>[0]));
    }
  });

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{tx(isEdit ? 'medical.form.editTitle' : 'medical.form.createTitle')}</DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {!!submitError && <Alert severity="error">{submitError}</Alert>}

            <RHFAutocomplete<EmployeeOption, false, false, false>
              name="employee"
              label={`${tx('medical.form.employee')} *`}
              options={employeeOptions}
              getOptionLabel={(option) => option.fullName}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(options) => options}
              onInputChange={(_event, value) => setEmployeeSearch(value)}
              noOptionsText={tx('common.table.noData')}
            />

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              }}
            >
              <RHFTextField
                name="bpSystolic"
                type="number"
                label={`${tx('medical.form.bpSystolic')} *`}
                inputProps={{ min: 40, max: 300, step: 1 }}
              />
              <RHFTextField
                name="bpDiastolic"
                type="number"
                label={`${tx('medical.form.bpDiastolic')} *`}
                inputProps={{ min: 20, max: 200, step: 1 }}
              />
              <RHFTextField
                name="pulse"
                type="number"
                label={`${tx('medical.form.pulse')} *`}
                inputProps={{ min: 20, max: 250, step: 1 }}
              />
              <RHFTextField
                name="saturation"
                type="number"
                label={`${tx('medical.form.saturation')} *`}
                inputProps={{ min: 50, max: 100, step: 1 }}
              />
              <RHFTextField
                name="hoursWorked"
                type="number"
                label={`${tx('medical.form.hoursWorked')} *`}
                inputProps={{ min: 0, max: 24, step: 0.5 }}
              />
              <RHFTextField
                name="hoursRested"
                type="number"
                label={`${tx('medical.form.hoursRested')} *`}
                inputProps={{ min: 0, max: 168, step: 0.5 }}
              />
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <RHFTextField
                name="alcoholValue"
                type="number"
                label={tx('medical.form.alcoholValue')}
                inputProps={{ min: 0, max: 99.999, step: 0.001 }}
                sx={{ flex: 1 }}
              />
              <RHFSwitch name="alcoholPositive" label={tx('medical.form.alcoholPositive')} />
            </Stack>

            {showRiskWarning && <Alert severity="warning">{tx('medical.warnings.outOfRange')}</Alert>}

            <RHFRadioGroup
              row
              name="conclusion"
              label={tx('medical.form.conclusion')}
              options={[
                { value: 'approved', label: tx('medical.conclusion.approved') },
                { value: 'rejected', label: tx('medical.conclusion.rejected') },
              ]}
            />

            <RHFTextField name="note" label={tx('medical.form.note')} multiline rows={3} />
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
