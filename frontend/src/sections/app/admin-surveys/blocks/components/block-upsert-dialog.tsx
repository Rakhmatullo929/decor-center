import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import LoadingButton from '@mui/lab/LoadingButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import useLocales from 'src/locales/use-locales';
import FormProvider, { RHFTextField } from 'src/components/hook-form';
import { useSnackbar } from 'src/components/snackbar';
import {
  useCreateQuestionBlockMutation,
  useUpdateQuestionBlockMutation,
} from '../../api/use-surveys-api';
import type { QuestionBlock } from '../../api/types';

type BlockFormValues = { order: number; title: string };

type Props = {
  open: boolean;
  onClose: VoidFunction;
  testId: number;
  block?: QuestionBlock | null;
  onSaved: (block: QuestionBlock, mode: 'create' | 'edit') => void;
};

export default function BlockUpsertDialog({ open, onClose, testId, block, onSaved }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = Boolean(block);

  const createMutation = useCreateQuestionBlockMutation();
  const updateMutation = useUpdateQuestionBlockMutation();

  const schema = useMemo(
    () =>
      Yup.object().shape({
        order: Yup.number()
          .transform((v, o) => (o === '' ? 0 : v))
          .min(0)
          .required(),
        title: Yup.string().ensure().max(255),
      }),
    []
  );

  const defaultValues = useMemo<BlockFormValues>(
    () => ({ order: block?.order ?? 0, title: block?.title ?? '' }),
    [block]
  );

  const methods = useForm<BlockFormValues>({
    resolver: yupResolver(schema),
    defaultValues,
    mode: 'onChange',
  });
  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const saved = isEdit
      ? await updateMutation.mutateAsync({
          id: (block as QuestionBlock).id,
          payload: { order: values.order, title: values.title },
        })
      : await createMutation.mutateAsync({ test: testId, order: values.order, title: values.title });
    enqueueSnackbar(tx(isEdit ? 'surveys.blocks.toasts.updated' : 'surveys.blocks.toasts.created'));
    onSaved(saved, isEdit ? 'edit' : 'create');
    onClose();
  });

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>
          {tx(isEdit ? 'surveys.blocks.form.editTitle' : 'surveys.blocks.form.createTitle')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <RHFTextField
              name="order"
              type="number"
              label={tx('surveys.blocks.form.order')}
              InputProps={{ inputProps: { min: 0 } }}
            />
            <RHFTextField name="title" label={tx('surveys.blocks.form.title')} autoFocus />
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
