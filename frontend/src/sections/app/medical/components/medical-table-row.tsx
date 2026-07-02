// @mui
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { fDateTime } from 'src/utils/format-time';
// components
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
//
import type { MedicalCheck } from '../api/types';

// ----------------------------------------------------------------------

/** "12.0" → "12", "12.5" → "12.5" (DRF decimals arrive as strings). */
function formatDecimal(value: string) {
  return String(Number(value));
}

type Props = {
  row: MedicalCheck;
  /** Medic can edit; admin is read-only. */
  canWrite: boolean;
  onDetail: (check: MedicalCheck) => void;
  onEdit: (check: MedicalCheck) => void;
};

export default function MedicalTableRow({ row, canWrite, onDetail, onEdit }: Props) {
  const { tx } = useLocales();
  const popover = usePopover();

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Typography
            variant="subtitle2"
            noWrap
            onClick={() => onDetail(row)}
            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            {row.employeeName}
          </Typography>
        </TableCell>

        <TableCell>{`${row.bpSystolic}/${row.bpDiastolic}`}</TableCell>

        <TableCell>{row.pulse}</TableCell>

        <TableCell>{`${row.saturation}%`}</TableCell>

        <TableCell>
          <Label color={row.alcoholPositive ? 'error' : 'success'}>
            {row.alcoholValue !== null ? formatDecimal(row.alcoholValue) : '—'}
          </Label>
        </TableCell>

        <TableCell>{formatDecimal(row.hoursWorked)}</TableCell>

        <TableCell>{formatDecimal(row.hoursRested)}</TableCell>

        <TableCell>
          <Label color={row.conclusion === 'approved' ? 'success' : 'error'}>
            {tx(`medical.conclusion.${row.conclusion}`)}
          </Label>
        </TableCell>

        <TableCell>{row.medicUsername}</TableCell>

        <TableCell>{fDateTime(row.createdAt)}</TableCell>

        <TableCell align="right">
          <IconButton color={popover.open ? 'inherit' : 'default'} onClick={popover.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 160 }}>
        <MenuItem
          onClick={() => {
            popover.onClose();
            onDetail(row);
          }}
        >
          <Iconify icon="solar:eye-bold" />
          {tx('common.actions.view')}
        </MenuItem>

        {canWrite && (
          <MenuItem
            onClick={() => {
              popover.onClose();
              onEdit(row);
            }}
          >
            <Iconify icon="solar:pen-bold" />
            {tx('common.actions.edit')}
          </MenuItem>
        )}
      </CustomPopover>
    </>
  );
}
