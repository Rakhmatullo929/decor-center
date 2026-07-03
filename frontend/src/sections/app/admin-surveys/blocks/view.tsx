import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
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
import { useQuestionBlocksQuery, useDeleteQuestionBlockMutation } from '../api/use-surveys-api';
import type { QuestionBlock } from '../api/types';
import BlockUpsertDialog from './components/block-upsert-dialog';

export default function BlocksView() {
  const { tx } = useLocales();
  const settings = useSettingsContext();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { canWritePage } = useCheckPermission();
  const canWrite = canWritePage('tests');

  const { testId: testIdParam } = useParams();
  const testId = Number(testIdParam);

  const blocksQuery = useQuestionBlocksQuery(testId);
  const blocks = blocksQuery.data?.results ?? [];

  const deleteMutation = useDeleteQuestionBlockMutation();
  const dialog = useBoolean();
  const [editing, setEditing] = useState<QuestionBlock | null>(null);
  const [deleting, setDeleting] = useState<QuestionBlock | null>(null);

  const handleSaved = (block: QuestionBlock, mode: 'create' | 'edit') => {
    if (mode === 'create') blocksQuery.addItem(block);
    else blocksQuery.updateItem(block);
  };

  const handleConfirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        blocksQuery.deleteItem(deleting.id);
        enqueueSnackbar(tx('surveys.blocks.toasts.deleted'));
        setDeleting(null);
      },
    });
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={tx('surveys.blocks.title')}
        links={[
          { name: tx('surveys.tests.title'), href: paths.app.surveys.tests },
          { name: tx('surveys.blocks.title') },
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
              {tx('surveys.blocks.actions.create')}
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        {blocks.length === 0 ? (
          <EmptyContent filled title={tx('surveys.blocks.empty')} sx={{ py: 10 }} />
        ) : (
          <List disablePadding>
            {blocks.map((block) => (
              <ListItem
                key={block.id}
                divider
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    <IconButton onClick={() => navigate(paths.app.surveys.questions(block.id))}>
                      <Iconify icon="solar:question-circle-bold" />
                    </IconButton>
                    {canWrite && (
                      <IconButton
                        onClick={() => {
                          setEditing(block);
                          dialog.onTrue();
                        }}
                      >
                        <Iconify icon="solar:pen-bold" />
                      </IconButton>
                    )}
                    {canWrite && (
                      <IconButton color="error" onClick={() => setDeleting(block)}>
                        <Iconify icon="solar:trash-bin-trash-bold" />
                      </IconButton>
                    )}
                  </Stack>
                }
              >
                <ListItemText
                  primary={block.title || tx('surveys.blocks.untitled')}
                  secondary={tx('surveys.blocks.orderLabel', { order: block.order })}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Card>

      <BlockUpsertDialog
        open={dialog.value}
        onClose={dialog.onFalse}
        testId={testId}
        block={editing}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={tx('surveys.blocks.dialogs.delete.title')}
        content={tx('surveys.blocks.dialogs.delete.content')}
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
