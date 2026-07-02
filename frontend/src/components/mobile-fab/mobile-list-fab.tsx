import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

type SecondaryAction = {
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

type Props = {
  onClick: () => void;
  disabled?: boolean;
  secondaryAction?: SecondaryAction;
};

export default function MobileListFab({ onClick, disabled, secondaryAction }: Props) {
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: { xs: 'flex', md: 'none' },
        alignItems: 'center',
        gap: 1,
        zIndex: (t) => t.zIndex.fab,
      }}
    >
      {secondaryAction && (
        <Fab
          size="small"
          onClick={secondaryAction.onClick}
          disabled={secondaryAction.disabled}
          aria-label={secondaryAction.ariaLabel}
          sx={{
            bgcolor: 'background.paper',
            color: 'text.secondary',
            boxShadow: 4,
            '&:hover': { bgcolor: 'background.neutral' },
          }}
        >
          <Iconify icon={secondaryAction.icon} width={20} />
        </Fab>
      )}

      <Fab color="primary" onClick={onClick} disabled={disabled}>
        <Iconify icon="mingcute:add-line" width={24} />
      </Fab>
    </Box>
  );
}
