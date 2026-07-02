// @mui
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
// components
import { TableSkeleton } from 'src/components/table';

// ----------------------------------------------------------------------

type ResultsTableSkeletonProps = {
  rows?: number;
};

export function ResultsTableSkeleton({ rows = 8 }: ResultsTableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <TableSkeleton key={index} />
      ))}
    </>
  );
}

// ----------------------------------------------------------------------

export function ResultDetailSkeleton() {
  return (
    <>
      <Card sx={{ p: 3, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          justifyContent="space-between"
          alignItems={{ md: 'center' }}
        >
          <Stack spacing={2} sx={{ flexGrow: 1 }}>
            <Skeleton sx={{ width: '40%', height: 28 }} />
            <Skeleton sx={{ width: '60%', height: 12 }} />
            <Skeleton sx={{ width: '50%', height: 12 }} />
            <Skeleton sx={{ width: '55%', height: 12 }} />
            <Skeleton sx={{ width: '45%', height: 12 }} />
          </Stack>

          <Stack spacing={1.5} alignItems="center" sx={{ px: { md: 5 } }}>
            <Skeleton variant="rounded" sx={{ width: 140, height: 56 }} />
            <Skeleton sx={{ width: 80, height: 16 }} />
          </Stack>
        </Stack>
      </Card>

      <Card sx={{ p: 3 }}>
        <Skeleton sx={{ width: 160, height: 20, mb: 3 }} />
        <Stack spacing={4}>
          {Array.from({ length: 3 }, (_, index) => (
            <Stack key={index} spacing={1.5}>
              <Skeleton sx={{ width: '70%', height: 14 }} />
              <Skeleton variant="rounded" sx={{ height: 40 }} />
              <Skeleton variant="rounded" sx={{ height: 40 }} />
              <Skeleton variant="rounded" sx={{ height: 40 }} />
              <Skeleton variant="rounded" sx={{ height: 40 }} />
            </Stack>
          ))}
        </Stack>
      </Card>
    </>
  );
}
