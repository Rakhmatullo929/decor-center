import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useBoolean } from 'src/hooks/use-boolean';
import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  filtersCount?: number;
  title?: string;
  resetLabel?: string;
  onReset: () => void;
  children: React.ReactNode;
};

export default function FilterDrawer({
  filtersCount = 0,
  title = 'Filters',
  resetLabel = 'Reset',
  onReset,
  children,
}: Props) {
  const open = useBoolean();

  const handleReset = () => {
    onReset();
  };

  return (
    <>
      <Badge badgeContent={filtersCount} color="error">
        <Button
          variant="outlined"
          startIcon={<Iconify icon="ic:round-filter-list" />}
          onClick={open.onTrue}
          color={filtersCount > 0 ? 'primary' : 'inherit'}
          aria-label={title}
          sx={{
            px: { xs: 1, sm: 2 },
            '& .MuiButton-startIcon': {
              mr: { xs: 0, sm: 1 },
              ml: { xs: 0, sm: -0.5 },
            },
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {title}
          </Box>
        </Button>
      </Badge>

      <Drawer
        anchor="right"
        open={open.value}
        onClose={open.onFalse}
        PaperProps={{ sx: { width: { xs: 'calc(100vw - 32px)', sm: 320 }, maxWidth: 320, p: 0 } }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2.5, py: 2 }}
        >
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={open.onFalse}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Stack>

        <Divider />

        <Box sx={{ px: 2.5, py: 3, flexGrow: 1, overflow: 'auto' }}>
          <Stack spacing={3}>{children}</Stack>
        </Box>

        <Divider />

        <Stack sx={{ px: 2.5, py: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            startIcon={<Iconify icon="solar:restart-bold" />}
            onClick={handleReset}
            disabled={filtersCount === 0}
          >
            {resetLabel}
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
