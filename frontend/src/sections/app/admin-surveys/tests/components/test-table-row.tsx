import { useNavigate } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useLocales from 'src/locales/use-locales';
import { paths } from 'src/routes/paths';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import type { Test } from '../../api/types';

type Props = {
  row: Test;
  canWrite: boolean;
  onEdit: (test: Test) => void;
  onDelete: (test: Test) => void;
};

function scheduleLabel(row: Test, tx: (k: string, o?: Record<string, string | number>) => string) {
  if (row.isAdminConducted) return tx('surveys.tests.schedule.adminConducted');
  if (row.isAfterApplication)
    return tx('surveys.tests.schedule.afterDays', { days: row.afterDays ?? 0 });
  const months = row.month.length ? row.month.join(', ') : tx('surveys.tests.form.monthsAny');
  return tx('surveys.tests.schedule.periodic', {
    months,
    from: row.testDaysFrom ?? 1,
    to: row.testDaysTo ?? row.testDaysFrom ?? 1,
  });
}

export default function TestTableRow({ row, canWrite, onEdit, onDelete }: Props) {
  const { tx } = useLocales();
  const popover = usePopover();
  const navigate = useNavigate();

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Typography variant="subtitle2">{row.title}</Typography>
        </TableCell>
        <TableCell>{scheduleLabel(row, tx)}</TableCell>
        <TableCell>
          <Label color={row.isActive ? 'success' : 'default'}>
            {tx(row.isActive ? 'common.status.active' : 'common.status.inactive')}
          </Label>
        </TableCell>
        <TableCell align="right">
          <IconButton onClick={popover.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="top-right" sx={{ width: 220 }}>
        <MenuItem
          onClick={() => {
            popover.onClose();
            navigate(paths.app.surveys.blocks(row.id));
          }}
        >
          <Iconify icon="solar:list-bold" />
          {tx('surveys.tests.actions.manageBlocks')}
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
        {canWrite && (
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
        )}
      </CustomPopover>
    </>
  );
}
