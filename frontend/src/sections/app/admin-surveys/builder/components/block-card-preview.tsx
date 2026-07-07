import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';

import type { QuestionBlock } from '../../api/types';

type Props = {
  block: QuestionBlock;
  blockIndex: number;
};

/** Static stand-in for `BlockListRow`, rendered inside `DragOverlay` so a
 * dragged block keeps looking like the real card instead of a bare label. */
export default function BlockCardPreview({ block, blockIndex }: Props) {
  const { tx } = useLocales();
  const questionCount = block.questions?.length ?? 0;
  const title = block.title.ru || block.title.uz || tx('surveys.builder.untitledBlock');

  return (
    <Card
      sx={{
        p: 3,
        width: 480,
        maxWidth: '90vw',
        cursor: 'grabbing',
        boxShadow: (theme) => theme.customShadows?.z24,
        transform: 'rotate(1.5deg) scale(1.02)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Iconify icon="mingcute:dots-fill" width={22} sx={{ color: 'text.disabled' }} />
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.lighter', color: 'primary.darker' }}>
          <Typography variant="subtitle2">{blockIndex + 1}</Typography>
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>
            {title}
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 2.5 }} />

      <Label variant="soft" color="default">
        {tx('surveys.builder.questionCount', { count: questionCount })}
      </Label>
    </Card>
  );
}
