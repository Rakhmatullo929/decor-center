import type { PropsWithChildren, ReactNode } from 'react';
// @mui
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
// components
import Logo from 'src/components/logo';

// ----------------------------------------------------------------------

type Props = PropsWithChildren<{
  /** Rendered top-right, next to the logo (e.g. language switch, or language + logout in the employee cabinet). */
  action?: ReactNode;
  /** Card width on larger screens. Wider for lists/questions, narrower for single-focus steps. */
  maxWidth?: number;
}>;

/**
 * Shared shell for every /scan and /employee step: a small top bar (logo + action) and one
 * centered card. Each step owns its own heading/copy — this only provides the frame, so
 * spacing and layout stay consistent across the whole employee flow (DRY).
 */
export default function SurveyPanel({ children, action, maxWidth = 440 }: Props) {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.neutral',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}
      >
        <Logo disabledLink sx={{ width: 32, height: 32 }} />
        {action}
      </Stack>

      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          pb: { xs: 4, md: 6 },
        }}
      >
        <Card sx={{ width: 1, maxWidth, p: { xs: 3, sm: 5 } }}>{children}</Card>
      </Box>
    </Box>
  );
}
