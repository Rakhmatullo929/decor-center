// @mui
import { alpha, useTheme } from '@mui/material/styles';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// components
import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  title: string;
  value: number | string;
  icon: string;
  color?: 'primary' | 'success' | 'error' | 'warning' | 'info';
};

export default function StatCard({ title, value, icon, color = 'primary' }: Props) {
  const theme = useTheme();

  return (
    <Card sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 1.5,
            color: `${color}.main`,
            bgcolor: alpha(theme.palette[color].main, 0.08),
          }}
        >
          <Iconify icon={icon} width={28} />
        </Stack>

        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="h4">{value}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
            {title}
          </Typography>
        </Stack>
      </Stack>
    </Card>
  );
}
