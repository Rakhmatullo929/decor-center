import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import FormProvider, { RHFSwitch, RHFTextField } from 'src/components/hook-form';
import { useSnackbar } from 'src/components/snackbar';
//
import { useCreateSpecialtyMutation, useUpdateSpecialtyMutation } from '../api/use-specialties-api';
import type { Specialty } from '../api/types';
import { buildSpecialtySchema, type SpecialtyFormValues } from './utils/specialty-schema';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  specialty?: Specialty | null;
  onSaved: (specialty: Specialty, mode: 'create' | 'edit') => void;
};

export default function SpecialtyUpsertDialog({ open, onClose, specialty, onSaved }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();

  const isEdit = Boolean(specialty);

  const createMutation = useCreateSpecialtyMutation();
  const updateMutation = useUpdateSpecialtyMutation();

  const defaultValues = useMemo<SpecialtyFormValues>(
    () => ({
      name: specialty?.name ?? '',
      isActive: specialty?.isActive ?? true,
    }),
    [specialty]
  );

  const methods = useForm<SpecialtyFormValues>({
    resolver: yupResolver(buildSpecialtySchema(tx)),
    defaultValues,
    mode: 'onChange',
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) {
      reset(defaultValues);
    }
  }, [open, defaultValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const saved = isEdit
      ? await updateMutation.mutateAsync({
          id: (specialty as Specialty).id,
          payload: { name: values.name, isActive: values.isActive },
        })
      : await createMutation.mutateAsync({ name: values.name, isActive: values.isActive });

    enqueueSnackbar(tx(isEdit ? 'specialties.toasts.updated' : 'specialties.toasts.created'));
    onSaved(saved, isEdit ? 'edit' : 'create');
    onClose();
  });

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>
          {tx(isEdit ? 'specialties.form.editTitle' : 'specialties.form.createTitle')}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <RHFTextField name="name" label={`${tx('specialties.form.name')} *`} autoFocus />
            {isEdit && <RHFSwitch name="isActive" label={tx('specialties.form.active')} />}
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
