import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import FormProvider, { RHFTextField } from 'src/components/hook-form';
import { useSnackbar } from 'src/components/snackbar';
//
import { useGenerateQuestionsMutation } from '../api/use-instructions-api';
import type { Instruction } from '../api/types';
import {
  GENERATE_COUNT_DEFAULT,
  GENERATE_COUNT_MAX,
  GENERATE_COUNT_MIN,
  buildGenerateQuestionsSchema,
  type GenerateQuestionsFormValues,
} from './utils/generate-questions-schema';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  instruction: Instruction | null;
};

export default function GenerateQuestionsDialog({ open, onClose, instruction }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const generateMutation = useGenerateQuestionsMutation();

  const defaultValues = useMemo<GenerateQuestionsFormValues>(
    () => ({ count: GENERATE_COUNT_DEFAULT }),
    []
  );

  const methods = useForm<GenerateQuestionsFormValues>({
    resolver: yupResolver(buildGenerateQuestionsSchema(tx)),
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
    if (!instruction) return;
    try {
      const result = await generateMutation.mutateAsync({
        id: instruction.id,
        payload: { count: values.count },
      });

      enqueueSnackbar(tx('instructions.toasts.generated', { count: result.created }));
      // Generation changes server-computed fields (generation_status, last_generated_at)
      // and inserts new draft questions — a local cache update is unreliable here.
      queryClient.invalidateQueries({ queryKey: ['instructions'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      onClose();
    } catch {
      // Global error toast already shown; the backend flips the status to "failed".
      queryClient.invalidateQueries({ queryKey: ['instructions'] });
    }
  });

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{tx('instructions.generate.title')}</DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {tx('instructions.generate.description', { title: instruction?.title ?? '' })}
            </Typography>

            <RHFTextField
              name="count"
              type="number"
              label={`${tx('instructions.generate.count')} *`}
              inputProps={{ min: GENERATE_COUNT_MIN, max: GENERATE_COUNT_MAX }}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={onClose}>
            {tx('common.actions.cancel')}
          </Button>
          <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
            {tx('instructions.generate.submit')}
          </LoadingButton>
        </DialogActions>
      </FormProvider>
    </Dialog>
  );
}
