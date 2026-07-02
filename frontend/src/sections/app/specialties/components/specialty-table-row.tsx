// @mui
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { fDate } from 'src/utils/format-time';
// components
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
//
import type { Specialty } from '../api/types';

// ----------------------------------------------------------------------

type Props = {
  row: Specialty;
  canWrite: boolean;
  onEdit: (specialty: Specialty) => void;
  onDelete: (specialty: Specialty) => void;
};

export default function SpecialtyTableRow({ row, canWrite, onEdit, onDelete }: Props) {
  const { tx } = useLocales();
  const popover = usePopover();

  return (
    <>
      <TableRow hover>
        <TableCell>{row.name}</TableCell>

        <TableCell>
          <Label color={row.isActive ? 'success' : 'default'}>
            {tx(row.isActive ? 'common.status.active' : 'common.status.inactive')}
          </Label>
        </TableCell>

        <TableCell>{fDate(row.createdAt)}</TableCell>

        {canWrite && (
          <TableCell align="right">
            <IconButton color={popover.open ? 'inherit' : 'default'} onClick={popover.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </TableCell>
        )}
      </TableRow>

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 160 }}>
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
            onDelete(row);
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          {tx('common.actions.delete')}
        </MenuItem>
      </CustomPopover>
    </>
  );
}
