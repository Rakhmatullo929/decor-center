import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';
import Iconify from 'src/components/iconify';

export type ProfileCoverChip = {
  key: string;
  title?: string;
  icon: string;
  label: string;
};

type Props = {
  title: string;
  subtitle?: string;
  subtitleIcon?: string;
  editHref?: string;
  canEdit?: boolean;
  chips?: ProfileCoverChip[];
  editLabel: string;
  emptyLabel: string;
};

export default function ProfileCover({
  title,
  subtitle = '',
  subtitleIcon = 'solar:phone-calling-rounded-bold',
  editHref = '',
  canEdit = false,
  chips = [],
  editLabel,
  emptyLabel,
}: Props) {
  const theme = useTheme();

  return (
    <Card
      sx={{
        p: 0,
        borderRadius: 3,
        border: (muiTheme) => `1px solid ${muiTheme.palette.divider}`,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: { xs: 2, md: 3.5 },
          py: { xs: 2.2, md: 3 },
          position: 'relative',
          background: `radial-gradient(circle at 18% 18%, ${alpha(theme.palette.primary.main, 0.2)} 0%, transparent 35%), linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.14)} 0%, ${alpha(theme.palette.info.main, 0.1)} 45%, ${theme.palette.background.paper} 100%)`,
          '&::after': {
            content: '""',
            position: 'absolute',
            right: -40,
            top: -40,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 2, md: 3 }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          sx={{ position: 'relative', zIndex: 1 }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              sx={{
                width: { xs: 62, md: 72 },
                height: { xs: 62, md: 72 },
                bgcolor: 'background.paper',
                color: 'primary.main',
                fontSize: { xs: 24, md: 30 },
                fontWeight: 800,
                border: (innerTheme) => `2px solid ${alpha(innerTheme.palette.primary.main, 0.3)}`,
                boxShadow: (innerTheme) => innerTheme.customShadows.z8,
              }}
            >
              {title.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h4" sx={{ lineHeight: 1.1 }} noWrap>
                {title}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.9 }}>
                <Iconify icon={subtitleIcon} width={16} />
                <Typography variant="body2" color="text.secondary">
                  {subtitle || emptyLabel}
                </Typography>
              </Stack>
            </Box>
          </Stack>
          {canEdit && editHref ? (
            <Button
              component={RouterLink}
              href={editHref}
              variant="contained"
              size="medium"
              startIcon={<Iconify icon="solar:pen-bold" />}
            >
              {editLabel}
            </Button>
          ) : null}
        </Stack>
      </Box>
      <Divider />
      <Box sx={{ px: { xs: 2, md: 3.5 }, py: { xs: 1.6, md: 2.2 }, bgcolor: alpha(theme.palette.background.neutral, 0.25) }}>
        <Grid container spacing={1.2}>
          {chips.map((item) => (
            <Grid key={item.key} item xs={12} sm={6} md={3}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  px: 1.2,
                  py: 1,
                  borderRadius: 1.5,
                  bgcolor: 'background.paper',
                  border: (innerTheme) => `1px solid ${alpha(innerTheme.palette.primary.main, 0.16)}`,
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1.2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.main',
                    flexShrink: 0,
                  }}
                >
                  <Iconify icon={item.icon} width={15} />
                </Box>
                <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                    {item.title || item.key}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: item.label === emptyLabel ? 'text.disabled' : 'text.primary',
                      lineHeight: 1.1,
                    }}
                    noWrap
                  >
                    {item.label}
                  </Typography>
                </Stack>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Box>
      {chips.length === 0 ? <Box sx={{ pb: 0.5 }} /> : null}
    </Card>
  );
}
