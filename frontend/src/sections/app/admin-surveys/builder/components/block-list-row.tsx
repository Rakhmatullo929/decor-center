import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import { ConfirmDialog } from 'src/components/custom-dialog';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import { useBoolean } from 'src/hooks/use-boolean';

import type { LocalizedText, QuestionBlock } from '../../api/types';
import BilingualTextField from './bilingual-text-field';
import DragHandle from './drag-handle';

type Props = {
  block: QuestionBlock;
  blockIndex: number;
  onTitleChange: (title: LocalizedText) => void;
  onDelete: () => void;
  onOpen: () => void;
};

/** One row of the blocks-only list page — title + question count + a link into
 * that block's own questions page. No nested question editing here by design:
 * that's the whole point of splitting the page (see BlockQuestionsView).
 *
 * The title shows read-only by default (a list of N rows each showing two live
 * text inputs reads as a wall of forms, not a list) — tap the pencil to rename. */
export default function BlockListRow({ block, blockIndex, onTitleChange, onDelete, onOpen }: Props) {
  const { tx } = useLocales();
  const questionCount = block.questions?.length ?? 0;
  const deleteConfirm = useBoolean();
  const editing = useBoolean();

  const { setNodeRef, attributes, listeners, transform, transition, isDragging, isOver } = useSortable({
    id: `block-${block.id}`,
    data: { type: 'block' },
  });

  const primaryTitle = block.title.ru || block.title.uz;
  const secondaryTitle = block.title.ru && block.title.uz ? block.title.uz : null;

  return (
    <>
      <Card
        ref={setNodeRef}
        sx={{
          p: 3,
          opacity: isDragging ? 0.6 : 1,
          transform: CSS.Transform.toString(transform),
          transition,
          bgcolor: isOver ? 'action.hover' : 'background.paper',
          boxShadow: isOver ? (theme) => theme.customShadows?.z8 : undefined,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <DragHandle width={22} attributes={attributes} listeners={listeners} />
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.lighter', color: 'primary.darker' }}>
            <Typography variant="subtitle2">{blockIndex + 1}</Typography>
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {editing.value ? (
              <BilingualTextField
                label={tx('surveys.builder.form.blockTitle')}
                value={block.title}
                onChange={onTitleChange}
                showFlagIcons
              />
            ) : (
              <Box
                onClick={editing.onTrue}
                sx={{ cursor: 'pointer', py: 0.5, '&:hover': { opacity: 0.72 } }}
              >
                <Typography variant="subtitle1" noWrap>
                  {primaryTitle || tx('surveys.builder.untitledBlock')}
                </Typography>
                {secondaryTitle && (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {secondaryTitle}
                  </Typography>
                )}
              </Box>
            )}
          </Box>

          <Tooltip title={tx(editing.value ? 'common.actions.save' : 'common.actions.edit')}>
            <IconButton onClick={editing.onToggle}>
              <Iconify icon={editing.value ? 'solar:check-circle-bold' : 'solar:pen-bold'} />
            </IconButton>
          </Tooltip>
          <Tooltip title={tx('surveys.builder.dialogs.deleteBlock.title')}>
            <IconButton color="error" onClick={deleteConfirm.onTrue}>
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ my: 2.5 }} />

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Label variant="soft" color="default">
            {tx('surveys.builder.questionCount', { count: questionCount })}
          </Label>
          <Button
            size="small"
            variant="contained"
            endIcon={<Iconify icon="mingcute:right-line" />}
            onClick={onOpen}
          >
            {tx('surveys.builder.actions.openQuestions')}
          </Button>
        </Stack>
      </Card>

      <ConfirmDialog
        open={deleteConfirm.value}
        onClose={deleteConfirm.onFalse}
        title={tx('surveys.builder.dialogs.deleteBlock.title')}
        content={tx('surveys.builder.dialogs.deleteBlock.content')}
        cancelText={tx('common.actions.cancel')}
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              deleteConfirm.onFalse();
              onDelete();
            }}
          >
            {tx('common.actions.delete')}
          </Button>
        }
      />
    </>
  );
}
