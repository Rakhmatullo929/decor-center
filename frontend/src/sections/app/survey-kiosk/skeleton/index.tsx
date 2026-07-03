// @mui
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

// ----------------------------------------------------------------------

type Props = {
  items?: number;
};

export function SurveyEmployeesGridSkeleton({ items = 5 }: Props) {
  return (
    <Stack spacing={0}>
      {Array.from({ length: items }, (_, index) => (
        <Box key={index}>
          {/* Mirrors EmployeeRow: px 5 (md), py 3 (md), gap 3, index 36px, avatar 52px */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 2.5, md: 3 },
              px: { xs: 3, md: 5 },
              py: { xs: 2.5, md: 3 },
            }}
          >
            <Skeleton
              variant="text"
              width={24}
              height={14}
              sx={{ bgcolor: alpha('#6366f1', 0.07), flexShrink: 0 }}
            />
            <Skeleton
              variant="circular"
              width={52}
              height={52}
              sx={{ bgcolor: alpha('#6366f1', 0.09), flexShrink: 0 }}
            />
            <Stack spacing={1} sx={{ flex: 1 }}>
              <Skeleton
                variant="text"
                height={16}
                sx={{ width: '42%', bgcolor: alpha('#fff', 0.07) }}
              />
              <Skeleton
                variant="text"
                height={11}
                sx={{ width: '26%', bgcolor: alpha('#fff', 0.04) }}
              />
            </Stack>
          </Box>
          {index < items - 1 && (
            <Box
              sx={{
                mx: { xs: 3, md: 5 },
                height: '1px',
                background: `linear-gradient(to right, transparent, ${alpha('#6366f1', 0.09)}, transparent)`,
              }}
            />
          )}
        </Box>
      ))}
    </Stack>
  );
}
