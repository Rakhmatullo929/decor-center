// @mui
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
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
import type { Question } from '../api/types';
import { QUESTION_MODULE_LABELS } from './utils/question-constants';

// ----------------------------------------------------------------------

type Props = {
  row: Question;
  canWrite: boolean;
  onEdit: (question: Question) => void;
  onApprove: (question: Question) => void;
  onDelete: (question: Question) => void;
};

export default function QuestionTableRow({ row, canWrite, onEdit, onApprove, onDelete }: Props) {
  const { tx } = useLocales();
  const popover = usePopover();

  const isDraft = row.status === 'draft';

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Tooltip title={row.text}>
            <Typography
              variant="body2"
              sx={{
                maxWidth: 320,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.text}
            </Typography>
          </Tooltip>
        </TableCell>

        <TableCell>{tx(QUESTION_MODULE_LABELS[row.module])}</TableCell>

        <TableCell>{row.specialtyName ?? '—'}</TableCell>

        <TableCell>
          <Label variant="soft" color={row.source === 'ai' ? 'info' : 'default'}>
            {tx(row.source === 'ai' ? 'questions.source.ai' : 'questions.source.manual')}
          </Label>
        </TableCell>

        <TableCell>
          <Label color={isDraft ? 'warning' : 'success'}>
            {tx(isDraft ? 'common.status.draft' : 'common.status.approved')}
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

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 180 }}>
        <MenuItem
          onClick={() => {
            popover.onClose();
            onEdit(row);
          }}
        >
          <Iconify icon="solar:pen-bold" />
          {tx('common.actions.edit')}
        </MenuItem>

        {isDraft && (
          <MenuItem
            onClick={() => {
              popover.onClose();
              onApprove(row);
            }}
            sx={{ color: 'success.main' }}
          >
            <Iconify icon="solar:check-circle-bold" />
            {tx('common.actions.approve')}
          </MenuItem>
        )}

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
