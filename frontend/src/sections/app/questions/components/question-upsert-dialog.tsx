import { useEffect, useMemo, useState } from 'react';
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
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { errorReader } from 'src/utils/error-reader';
// components
import FormProvider, { RHFSelect, RHFTextField } from 'src/components/hook-form';
import { useSnackbar } from 'src/components/snackbar';
//
import { useSpecialtyOptionsQuery } from '../../specialties/api/use-specialties-api';
import { useCreateQuestionMutation, useUpdateQuestionMutation } from '../api/use-questions-api';
import type { Question, QuestionModule } from '../api/types';
import {
  OPTION_LETTERS,
  QUESTION_MODULES,
  QUESTION_MODULE_LABELS,
} from './utils/question-constants';
import { buildQuestionSchema, type QuestionFormValues } from './utils/question-schema';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  question?: Question | null;
  onSaved: (question: Question, mode: 'create' | 'edit') => void;
};

export default function QuestionUpsertDialog({ open, onClose, question, onSaved }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const [submitError, setSubmitError] = useState('');

  const isEdit = Boolean(question);

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = specialtyOptionsQuery.data?.results ?? [];

  const createMutation = useCreateQuestionMutation();
  const updateMutation = useUpdateQuestionMutation();

  const defaultValues = useMemo<QuestionFormValues>(
    () => ({
      module: question?.module ?? '',
      specialty: question?.specialty ?? '',
      text: question?.text ?? '',
      options: question?.options ?? ['', '', '', ''],
      correctOption: question?.correctOption ?? '',
    }),
    [question]
  );

  const methods = useForm<QuestionFormValues>({
    resolver: yupResolver(buildQuestionSchema(tx)),
    defaultValues,
    mode: 'onChange',
  });

  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const moduleValue = watch('module');
  const isSpecialtyModule = moduleValue === 'specialty';

  useEffect(() => {
    if (open) {
      setSubmitError('');
      reset(defaultValues);
    }
  }, [open, defaultValues, reset]);

  // Backend rejects a specialty on safety modules — drop it as soon as such a module is picked.
  useEffect(() => {
    if (moduleValue === 'tech_safety' || moduleValue === 'industrial_safety') {
      setValue('specialty', '');
    }
  }, [moduleValue, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      const payload = {
        module: values.module as QuestionModule,
        specialty: isSpecialtyModule ? Number(values.specialty) : null,
        text: values.text,
        options: values.options,
        correctOption: Number(values.correctOption),
      };
      const saved = isEdit
        ? await updateMutation.mutateAsync({ id: (question as Question).id, payload })
        : await createMutation.mutateAsync(payload);

      enqueueSnackbar(tx(isEdit ? 'questions.toasts.updated' : 'questions.toasts.created'));
      onSaved(saved, isEdit ? 'edit' : 'create');
      onClose();
    } catch (error) {
      // Typical case: module/specialty consistency errors from `QuestionAdminSerializer`.
      setSubmitError(errorReader(error));
    }
  });

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>
          {tx(isEdit ? 'questions.form.editTitle' : 'questions.form.createTitle')}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {!!submitError && <Alert severity="error">{submitError}</Alert>}

            <RHFSelect name="module" label={`${tx('questions.form.module')} *`}>
              {QUESTION_MODULES.map((module) => (
                <MenuItem key={module} value={module}>
                  {tx(QUESTION_MODULE_LABELS[module])}
                </MenuItem>
              ))}
            </RHFSelect>

            {isSpecialtyModule && (
              <RHFSelect name="specialty" label={`${tx('questions.form.specialty')} *`}>
                {specialtyOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.name}
                  </MenuItem>
                ))}
              </RHFSelect>
            )}

            <RHFTextField
              name="text"
              label={`${tx('questions.form.text')} *`}
              multiline
              rows={3}
            />

            {OPTION_LETTERS.map((letter, index) => (
              <RHFTextField
                key={letter}
                name={`options.${index}`}
                label={`${tx('questions.form.option', { letter })} *`}
              />
            ))}

            <RHFSelect name="correctOption" label={`${tx('questions.form.correctOption')} *`}>
              {OPTION_LETTERS.map((letter, index) => (
                <MenuItem key={letter} value={index}>
                  {letter}
                </MenuItem>
              ))}
            </RHFSelect>
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
