import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import { useBoolean } from 'src/hooks/use-boolean';
import { useSnackbar } from 'src/components/snackbar';
import { useCheckPermission } from 'src/auth/hooks';
import useLocales from 'src/locales/use-locales';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { ConfirmDialog } from 'src/components/custom-dialog';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import { paths } from 'src/routes/paths';
import { useQuestionsQuery, useDeleteQuestionMutation } from '../api/use-surveys-api';
import type { Question } from '../api/types';
import { default as QuestionUpsertDialog } from './components/question-upsert-dialog';

export default function QuestionsView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { canWritePage } = useCheckPermission();
  const canWrite = canWritePage('questions');

  const { blockId: blockIdParam } = useParams();
  const blockId = Number(blockIdParam);

  const questionsQuery = useQuestionsQuery(blockId);
  const questions = questionsQuery.data?.results ?? [];

  const deleteMutation = useDeleteQuestionMutation();
  const dialog = useBoolean();
  const [editing, setEditing] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);

  const handleSaved = (q: Question, mode: 'create' | 'edit') => {
    if (mode === 'create') questionsQuery.addItem(q);
    else questionsQuery.updateItem(q);
  };
  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        questionsQuery.deleteItem(deleting.id);
        enqueueSnackbar(tx('surveys.questions.toasts.deleted'));
        setDeleting(null);
      },
    });
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('surveys.questions.title')}
        links={[
          { name: tx('surveys.tests.title'), href: paths.app.surveys.tests },
          { name: tx('surveys.questions.title') },
        ]}
        action={
          canWrite && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => {
                setEditing(null);
                dialog.onTrue();
              }}
            >
              {tx('surveys.questions.actions.create')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        {questions.length === 0 ? (
          <EmptyContent filled title={tx('surveys.questions.empty')} sx={{ py: 10 }} />
        ) : (
          <List disablePadding>
            {questions.map((q) => (
              <ListItem
                key={q.id}
                divider
                secondaryAction={
                  canWrite && (
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        onClick={() => {
                          setEditing(q);
                          dialog.onTrue();
                        }}
                      >
                        <Iconify icon="solar:pen-bold" />
                      </IconButton>
                      <IconButton color="error" onClick={() => setDeleting(q)}>
                        <Iconify icon="solar:trash-bin-trash-bold" />
                      </IconButton>
                    </Stack>
                  )
                }
              >
                <ListItemText
                  primary={q.text}
                  secondary={
                    <Chip
                      size="small"
                      label={tx(`surveys.questions.types.${q.type}`)}
                      sx={{ mt: 0.5 }}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Card>

      <QuestionUpsertDialog
        open={dialog.value}
        onClose={dialog.onFalse}
        blockId={blockId}
        question={editing}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={tx('surveys.questions.dialogs.delete.title')}
        content={tx('surveys.questions.dialogs.delete.content')}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
            {tx('common.actions.delete')}
          </Button>
        }
      />
    </Container>
  );
}
