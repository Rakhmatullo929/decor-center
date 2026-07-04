import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import EmptyContent from 'src/components/empty-content';
import Iconify from 'src/components/iconify';

import type { LocalizedText, Question, QuestionBlock, QuestionType } from '../../api/types';
import AddQuestionMenu from './add-question-menu';
import BilingualTextField from './bilingual-text-field';
import SortableQuestionRow from './sortable-question-row';

type Props = {
  block: QuestionBlock;
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

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `block-${block.id}`,
    data: { type: 'block' },
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `blockdrop-${block.id}`,
    data: { type: 'blockdrop', blockId: block.id },
  });

  return (
    <Card
      ref={setNodeRef}
      variant="outlined"
      sx={{ p: 2, opacity: isDragging ? 0.6 : 1, transform: CSS.Transform.toString(transform), transition }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box {...attributes} {...listeners} sx={{ cursor: 'grab', pt: 1, touchAction: 'none' }}>
          <Iconify icon="mingcute:dots-fill" width={22} />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <BilingualTextField
            label={tx('surveys.builder.form.blockTitle')}
            value={block.title}
            onChange={onTitleChange}
          />
        </Box>
        <Tooltip title={tx('surveys.builder.dialogs.deleteBlock.title')}>
          <IconButton color="error" onClick={onDeleteBlock}>
            <Iconify icon="solar:trash-bin-trash-bold" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Box ref={setDropRef} sx={{ minHeight: 56 }}>
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
  );
}
