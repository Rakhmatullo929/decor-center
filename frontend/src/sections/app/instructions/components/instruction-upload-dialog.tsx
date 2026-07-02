import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { errorReader } from 'src/utils/error-reader';
// components
import FormProvider, { RHFSelect, RHFTextField, RHFUpload } from 'src/components/hook-form';
import { useSnackbar } from 'src/components/snackbar';
//
import { useSpecialtyOptionsQuery } from '../../specialties/api/use-specialties-api';
import { useCreateInstructionMutation } from '../api/use-instructions-api';
import type { Instruction } from '../api/types';
import { buildInstructionSchema, type InstructionFormValues } from './utils/instruction-schema';

// ----------------------------------------------------------------------

/** Mirrors the backend `FileExtensionValidator(["pdf", "docx", "txt", "md"])`. */
const ACCEPTED_FILES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
};

type Props = {
  open: boolean;
  onClose: VoidFunction;
  onUploaded: (instruction: Instruction) => void;
};

export default function InstructionUploadDialog({ open, onClose, onUploaded }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const [submitError, setSubmitError] = useState('');

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = specialtyOptionsQuery.data?.results ?? [];

  const createMutation = useCreateInstructionMutation();

  const defaultValues = useMemo<InstructionFormValues>(
    () => ({
      title: '',
      specialty: '',
      file: null,
    }),
    []
  );

  const methods = useForm<InstructionFormValues>({
    resolver: yupResolver(buildInstructionSchema(tx)),
    defaultValues,
    mode: 'onChange',
  });

  const {
    reset,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) {
      setSubmitError('');
      reset(defaultValues);
    }
  }, [open, defaultValues, reset]);

  const handleDropFile = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        setValue('file', Object.assign(file, { preview: URL.createObjectURL(file) }), {
          shouldValidate: true,
        });
      }
    },
    [setValue]
  );

  const handleRemoveFile = useCallback(() => {
    setValue('file', null, { shouldValidate: true });
  }, [setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      const uploaded = await createMutation.mutateAsync({
        title: values.title,
        specialty: Number(values.specialty),
        file: values.file as File,
      });

      enqueueSnackbar(tx('instructions.toasts.uploaded'));
      onUploaded(uploaded);
      onClose();
    } catch (error) {
      // Typical case: unsupported file extension rejected by the backend validator.
      setSubmitError(errorReader(error));
    }
  });

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{tx('instructions.form.uploadTitle')}</DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {!!submitError && <Alert severity="error">{submitError}</Alert>}

            <RHFTextField name="title" label={`${tx('instructions.form.title')} *`} autoFocus />

            <RHFSelect name="specialty" label={`${tx('instructions.form.specialty')} *`}>
              {specialtyOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </RHFSelect>

            <Stack spacing={1}>
              <RHFUpload
                name="file"
                accept={ACCEPTED_FILES}
                multiple={false}
                onDrop={handleDropFile}
                onDelete={handleRemoveFile}
              />
              <Typography variant="caption" color="text.secondary">
                {tx('instructions.form.fileHint')}
              </Typography>
            </Stack>
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
