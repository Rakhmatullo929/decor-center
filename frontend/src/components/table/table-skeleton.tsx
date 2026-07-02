// @mui
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import TableCell from '@mui/material/TableCell';
import TableRow, { TableRowProps } from '@mui/material/TableRow';

// ----------------------------------------------------------------------

export default function TableSkeleton({ ...other }: TableRowProps) {
  return (
    <TableRow {...other}>
      <TableCell colSpan={12}>
        <Stack spacing={3} direction="row" alignItems="center">
          <Skeleton sx={{ borderRadius: 1.5, width: 48, height: 48, flexShrink: 0 }} />
          <Skeleton sx={{ flexGrow: 3, height: 12 }} />
          <Skeleton sx={{ flexGrow: 2, height: 12 }} />
          <Skeleton sx={{ flexGrow: 2, height: 12 }} />
          <Skeleton sx={{ flexGrow: 1.5, height: 12 }} />
          <Skeleton sx={{ flexGrow: 1, height: 12 }} />
        </Stack>
      </TableCell>
    </TableRow>
  );
}
