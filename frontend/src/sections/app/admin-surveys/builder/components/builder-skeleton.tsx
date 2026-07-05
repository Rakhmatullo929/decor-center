import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

/** Shape-matched loading placeholder for the builder — mimics the block cards
 * and question rows so the layout doesn't jump once the real data lands. */
export default function BuilderSkeleton() {
  return (
    <Stack spacing={2}>
      {[0, 1].map((blockKey) => (
        <Card key={blockKey} sx={{ p: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="circular" width={22} height={22} />
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="rounded" height={40} sx={{ flexGrow: 1 }} />
            <Skeleton variant="circular" width={32} height={32} />
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          <Stack spacing={1.5}>
            {[0, 1, 2].map((rowKey) => (
              <Skeleton key={rowKey} variant="rounded" height={64} />
            ))}
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
            <Skeleton variant="text" width={90} />
            <Skeleton variant="rounded" width={120} height={32} />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
