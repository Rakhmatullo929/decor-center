// @mui
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Unstable_Grid2';

export function DashboardSkeleton() {
  return (
    <Grid container spacing={3}>
      {Array.from({ length: 8 }, (_, index) => (
        <Grid key={index} xs={12} sm={6} md={3}>
          <Card sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Skeleton variant="rounded" width={48} height={48} />
              <Stack spacing={1} sx={{ flexGrow: 1 }}>
                <Skeleton width="40%" height={24} />
                <Skeleton width="80%" height={14} />
              </Stack>
            </Stack>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
