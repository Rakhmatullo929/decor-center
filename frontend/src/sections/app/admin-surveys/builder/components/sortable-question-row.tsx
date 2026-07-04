import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';

import type { Question } from '../../api/types';
import { QUESTION_TYPE_META } from '../utils/question-type-meta';
import DragHandle from './drag-handle';
import QuestionEditorPanel from './question-editor-panel';

type Props = {
  question: Question;
  blockId: number;
  blockOptions: { id: number; label: string }[];
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<Question>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveToBlock: (targetBlockId: number) => void;
};

export default function SortableQuestionRow({
  question,
  blockId,
  blockOptions,
  expanded,
  onToggleExpand,
  onChange,
  onDelete,
  onDuplicate,
  onMoveToBlock,
}: Props) {
  const { tx } = useLocales();
  const meta = QUESTION_TYPE_META[question.type];
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: `question-${question.id}`,
    data: { type: 'question', blockId },
  });

  const preview = question.text.ru || question.text.uz || tx('surveys.builder.untitledQuestion');

  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        p: 2,
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        ...(expanded && { bgcolor: 'background.neutral' }),
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <DragHandle attributes={attributes} listeners={listeners} />
        <Iconify icon={meta.icon} width={20} style={{ marginTop: 2, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }} onClick={onToggleExpand}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
            {preview}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            <Label variant="soft">{tx(`surveys.builder.types.${question.type}`)}</Label>
            {question.isRequired && (
              <Label color="warning" variant="soft">
                {tx('surveys.builder.form.required')}
              </Label>
            )}
            {question.isMindDive && (
              <Label color="info" variant="soft">
                {tx('surveys.builder.form.mindDive')}
              </Label>
            )}
          </Stack>
        </Box>
        <Tooltip title={tx('surveys.builder.actions.duplicate')}>
          <IconButton size="small" onClick={onDuplicate}>
            <Iconify icon="solar:copy-bold" width={18} />
          </IconButton>
        </Tooltip>
        <Tooltip title={tx('common.actions.delete')}>
          <IconButton size="small" color="error" onClick={onDelete}>
            <Iconify icon="solar:trash-bin-trash-bold" width={18} />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={onToggleExpand}>
          <Iconify icon={expanded ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} width={18} />
        </IconButton>
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ pl: 5, pt: 2 }}>
          <QuestionEditorPanel
            question={question}
            blockOptions={blockOptions}
            onChange={onChange}
            onMoveToBlock={onMoveToBlock}
          />
        </Box>
      </Collapse>
    </Paper>
  );
}
