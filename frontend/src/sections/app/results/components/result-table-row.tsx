// @mui
import IconButton from '@mui/material/IconButton';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
// hooks
import useLocales from 'src/locales/use-locales';
// utils
import { fDateTime } from 'src/utils/format-time';
// components
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
//
import type { TestSessionRow } from '../api/types';
import { getSessionStatus } from './utils/session-status';

// ----------------------------------------------------------------------

type Props = {
  row: TestSessionRow;
  canDetail: boolean;
  onView: (row: TestSessionRow) => void;
};

export default function ResultTableRow({ row, canDetail, onView }: Props) {
  const { tx } = useLocales();

  const status = getSessionStatus(row.passed);

  return (
    <TableRow
      hover={canDetail}
      onClick={canDetail ? () => onView(row) : undefined}
      sx={canDetail ? { cursor: 'pointer' } : undefined}
    >
      <TableCell>
        <Typography variant="subtitle2" noWrap>
          {row.employeeName}
        </Typography>
      </TableCell>

      <TableCell>{row.specialtyName ?? '—'}</TableCell>

      <TableCell>{row.score === null ? '—' : `${row.score} / ${row.total}`}</TableCell>

      <TableCell>
        <Label color={status.color}>{tx(status.labelKey)}</Label>
      </TableCell>

      <TableCell>{fDateTime(row.startedAt)}</TableCell>

      {canDetail && (
        <TableCell align="right">
          <IconButton
            onClick={(event) => {
              event.stopPropagation();
              onView(row);
            }}
          >
            <Iconify icon="solar:eye-bold" />
          </IconButton>
        </TableCell>
      )}
    </TableRow>
  );
}
