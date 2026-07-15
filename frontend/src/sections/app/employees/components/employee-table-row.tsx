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
  onDelete: (employee: Employee) => void;
};

export default function EmployeeTableRow({
  row,
  canWrite,
  onEdit,
  onToggleActive,
  onDelete,
}: Props) {
  const { tx } = useLocales();
  const popover = usePopover();

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar src={row.photo ?? undefined} alt={row.fullName} sx={{ width: 40, height: 40 }}>
              {row.fullName.charAt(0).toUpperCase()}
            </Avatar>
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {row.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.phone}
              </Typography>
            </Stack>
          </Stack>
        </TableCell>

        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {row.specialtyName}
          </Typography>
        </TableCell>

        <TableCell>
          <Stack spacing={0.25}>
            <Typography variant="body2">{row.workExperience ?? '—'}</Typography>
            {!!row.hireDate && (
              <Typography variant="caption" color="text.secondary">
                {fDate(row.hireDate)}
              </Typography>
            )}
          </Stack>
        </TableCell>

        <TableCell>
          <Label color={row.isActive ? 'success' : 'default'}>
            {tx(row.isActive ? 'common.status.active' : 'common.status.inactive')}
          </Label>
        </TableCell>

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
          <Iconify icon={row.isActive ? 'solar:forbidden-circle-bold' : 'solar:restart-bold'} />
          {tx(row.isActive ? 'employees.actions.deactivate' : 'employees.actions.activate')}
        </MenuItem>

        <MenuItem
          onClick={() => {
            popover.onClose();
            onDelete(row);
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          {tx('employees.actions.delete')}
        </MenuItem>
      </CustomPopover>
    </>
  );
}
