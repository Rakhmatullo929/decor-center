// @mui
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { fDate } from 'src/utils/format-time';
// components
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
//
import type { Employee } from '../api/types';

// ----------------------------------------------------------------------

type Props = {
  row: Employee;
  canWrite: boolean;
  onEdit: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => void;
};

export default function EmployeeTableRow({
  row,
  canWrite,
  onEdit,
  onToggleActive,
}: Props) {
  const { tx } = useLocales();
  const popover = usePopover();

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar src={row.photo ?? undefined} alt={row.fullName} />
            <Typography variant="subtitle2" noWrap>
              {row.fullName}
            </Typography>
          </Stack>
        </TableCell>

        <TableCell>{row.specialtyName}</TableCell>

        <TableCell>
          <Label color={row.isActive ? 'success' : 'default'}>
            {tx(row.isActive ? 'common.status.active' : 'common.status.inactive')}
          </Label>
        </TableCell>

        <TableCell>{fDate(row.createdAt)}</TableCell>

        {canWrite && (
          <TableCell align="right">
            <IconButton
              onClick={popover.onOpen}
              sx={{ opacity: popover.open ? 0 : 1, pointerEvents: popover.open ? 'none' : 'auto' }}
            >
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </TableCell>
        )}
      </TableRow>

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="top-right" sx={{ width: 200 }}>
        <MenuItem
          onClick={() => {
            popover.onClose();
            onEdit(row);
          }}
        >
          <Iconify icon="solar:pen-bold" />
          {tx('common.actions.edit')}
        </MenuItem>

        <MenuItem
          onClick={() => {
            popover.onClose();
            onToggleActive(row);
          }}
          sx={{ color: row.isActive ? 'error.main' : 'success.main' }}
        >
          <Iconify icon={row.isActive ? 'solar:archive-bold' : 'solar:restart-bold'} />
          {tx(row.isActive ? 'employees.actions.archive' : 'employees.actions.activate')}
        </MenuItem>
      </CustomPopover>
    </>
  );
}
