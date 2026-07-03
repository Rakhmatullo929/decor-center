import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import LoadingButton from '@mui/lab/LoadingButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import uuidv4 from 'src/utils/uuidv4';
import FormProvider, { RHFSelect, RHFTextField } from 'src/components/hook-form';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useCreateQuestionMutation, useUpdateQuestionMutation } from '../../api/use-surveys-api';
import type { Question, QuestionType } from '../../api/types';
import { buildQuestionSchema, type QuestionFormValues } from './utils/question-schema';

const TYPE_OPTIONS: QuestionType[] = ['single', 'multiple', 'textarea'];

type Props = {
  open: boolean;
  onClose: VoidFunction;
  blockId: number;
  question?: Question | null;
  onSaved: (question: Question, mode: 'create' | 'edit') => void;
};

export default function QuestionUpsertDialog({ open, onClose, blockId, question, onSaved }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = Boolean(question);

  const createMutation = useCreateQuestionMutation();
  const updateMutation = useUpdateQuestionMutation();

  const defaultValues = useMemo<QuestionFormValues>(
    () => ({
      type: question?.type ?? 'single',
      order: question?.order ?? 0,
      text: question?.text ?? '',
      options: question?.options ?? [],
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
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'options' });

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const type = watch('type');
  const showOptions = type === 'single' || type === 'multiple';

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      block: blockId,
      type: values.type,
      order: values.order,
      text: values.text,
      options: values.type === 'textarea' ? [] : values.options,
    };
    const saved = isEdit
      ? await updateMutation.mutateAsync({ id: (question as Question).id, payload })
      : await createMutation.mutateAsync(payload);
    enqueueSnackbar(
      tx(isEdit ? 'surveys.questions.toasts.updated' : 'surveys.questions.toasts.created')
    );
    onSaved(saved, isEdit ? 'edit' : 'create');
    onClose();
  });

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>
          {tx(isEdit ? 'surveys.questions.form.editTitle' : 'surveys.questions.form.createTitle')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <RHFSelect name="type" label={tx('surveys.questions.form.type')}>
              {TYPE_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>
                  {tx(`surveys.questions.types.${t}`)}
                </MenuItem>
              ))}
            </RHFSelect>

            <RHFTextField
              name="order"
              type="number"
              label={tx('surveys.questions.form.order')}
              InputProps={{ inputProps: { min: 0 } }}
            />

            <RHFTextField
              name="text"
              label={`${tx('surveys.questions.form.text')} *`}
              multiline
              minRows={2}
            />

            {showOptions && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">{tx('surveys.questions.form.options')}</Typography>
                {fields.map((field, index) => (
                  <Stack key={field.id} direction="row" spacing={1} alignItems="center">
                    <RHFTextField
                      name={`options.${index}.text`}
                      label={tx('surveys.questions.form.optionLabel', { n: index + 1 })}
                      size="small"
                      fullWidth
                    />
                    <IconButton color="error" onClick={() => remove(index)}>
                      <Iconify icon="solar:trash-bin-trash-bold" />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  size="small"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  onClick={() => append({ id: uuidv4(), text: '' })}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {tx('surveys.questions.actions.addOption')}
                </Button>
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
