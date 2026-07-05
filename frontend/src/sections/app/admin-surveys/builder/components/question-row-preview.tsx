import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';

import type { Question } from '../../api/types';
import { QUESTION_TYPE_META } from '../utils/question-type-meta';

type Props = {
  question: Question;
};

/** Static stand-in for `SortableQuestionRow`, rendered inside `DragOverlay` so a
 * dragged question keeps looking like the real row instead of a bare label. */
export default function QuestionRowPreview({ question }: Props) {
  const { tx } = useLocales();
  const meta = QUESTION_TYPE_META[question.type];
  const preview = question.text.ru || question.text.uz || tx('surveys.builder.untitledQuestion');

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        width: 420,
        maxWidth: '85vw',
        cursor: 'grabbing',
        bgcolor: 'background.paper',
        boxShadow: (theme) => theme.customShadows?.z24,
        transform: 'rotate(1deg) scale(1.02)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Iconify icon="mingcute:dots-fill" width={20} sx={{ mt: 0.25, color: 'text.disabled', flexShrink: 0 }} />
        <Iconify icon={meta.icon} width={20} style={{ marginTop: 2, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
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
      </Stack>
    </Paper>
  );
}
