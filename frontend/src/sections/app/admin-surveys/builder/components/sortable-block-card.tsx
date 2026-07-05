import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';
import { useBoolean } from 'src/hooks/use-boolean';

import type { LocalizedText, Question, QuestionBlock, QuestionType } from '../../api/types';
import AddQuestionMenu from './add-question-menu';
import BilingualTextField from './bilingual-text-field';
import DragHandle from './drag-handle';
import SortableQuestionRow from './sortable-question-row';

type Props = {
  block: QuestionBlock;
  blockIndex: number;
  blockOptionsForMove: { id: number; label: string }[];
  expandedQuestionId: number | null;
  onToggleExpandQuestion: (questionId: number) => void;
  onTitleChange: (title: LocalizedText) => void;
  onDeleteBlock: () => void;
  onAddQuestion: (type: QuestionType) => void;
  onQuestionChange: (questionId: number, patch: Partial<Question>) => void;
  onDeleteQuestion: (questionId: number) => void;
  onDuplicateQuestion: (questionId: number) => void;
  onMoveQuestionToBlock: (questionId: number, targetBlockId: number) => void;
};

export default function SortableBlockCard({
  block,
  blockIndex,
  blockOptionsForMove,
  expandedQuestionId,
  onToggleExpandQuestion,
  onTitleChange,
  onDeleteBlock,
  onAddQuestion,
  onQuestionChange,
  onDeleteQuestion,
  onDuplicateQuestion,
  onMoveQuestionToBlock,
}: Props) {
  const { tx } = useLocales();
  const questions = block.questions ?? [];
  const deleteConfirm = useBoolean();

  const { setNodeRef, attributes, listeners, transform, transition, isDragging, isOver: isBlockOver } = useSortable({
    id: `block-${block.id}`,
    data: { type: 'block' },
  });
  const { setNodeRef: setDropRef, isOver: isQuestionDropOver } = useDroppable({
    id: `blockdrop-${block.id}`,
    data: { type: 'blockdrop', blockId: block.id },
  });

  return (
    <>
      <Card
        ref={setNodeRef}
        sx={{
          p: 3,
          opacity: isDragging ? 0.6 : 1,
          transform: CSS.Transform.toString(transform),
          transition,
          bgcolor: isBlockOver ? 'action.hover' : 'background.paper',
          boxShadow: isBlockOver ? (theme) => theme.customShadows?.z8 : undefined,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <DragHandle width={22} attributes={attributes} listeners={listeners} />
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.lighter', color: 'primary.darker' }}>
            <Typography variant="subtitle2">{blockIndex + 1}</Typography>
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <BilingualTextField
              label={tx('surveys.builder.form.blockTitle')}
              value={block.title}
              onChange={onTitleChange}
            />
          </Box>
          <Tooltip title={tx('surveys.builder.dialogs.deleteBlock.title')}>
            <IconButton color="error" onClick={deleteConfirm.onTrue}>
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Tooltip>
        </Stack>

        <Divider sx={{ my: 2.5 }} />

        <Box
          ref={setDropRef}
          sx={{
            minHeight: 56,
            borderRadius: 1,
            transition: (theme) => theme.transitions.create(['background-color', 'box-shadow']),
            ...(isQuestionDropOver && {
              bgcolor: 'action.hover',
              boxShadow: (theme) => `inset 0 0 0 2px ${theme.palette.primary.main}`,
            }),
          }}
        >
          <SortableContext items={questions.map((q) => `question-${q.id}`)} strategy={verticalListSortingStrategy}>
            <Stack spacing={1.5}>
              {questions.length === 0 && (
                <EmptyContent filled title={tx('surveys.builder.emptyQuestions')} sx={{ py: 4 }} />
              )}
              {questions.map((question) => (
                <SortableQuestionRow
                  key={question.id}
                  question={question}
                  blockId={block.id}
                  blockOptions={blockOptionsForMove}
                  expanded={expandedQuestionId === question.id}
                  onToggleExpand={() => onToggleExpandQuestion(question.id)}
                  onChange={(patch) => onQuestionChange(question.id, patch)}
                  onDelete={() => onDeleteQuestion(question.id)}
                  onDuplicate={() => onDuplicateQuestion(question.id)}
                  onMoveToBlock={(targetBlockId) => onMoveQuestionToBlock(question.id, targetBlockId)}
                />
              ))}
            </Stack>
          </SortableContext>
        </Box>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {tx('surveys.builder.questionCount', { count: questions.length })}
          </Typography>
          <AddQuestionMenu onSelect={onAddQuestion} />
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
              onDeleteBlock();
            }}
          >
            {tx('common.actions.delete')}
          </Button>
        }
      />
    </>
  );
}
