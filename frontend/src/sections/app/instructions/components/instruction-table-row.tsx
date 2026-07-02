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
import { fDate, fDateTime } from 'src/utils/format-time';
// components
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import type { LabelColor } from 'src/components/label';
//
import type { Instruction, InstructionGenerationStatus } from '../api/types';

// ----------------------------------------------------------------------

export const GENERATION_STATUS_META: Record<
  InstructionGenerationStatus,
  { color: LabelColor; labelKey: string }
> = {
  not_started: { color: 'default', labelKey: 'instructions.status.notStarted' },
  completed: { color: 'success', labelKey: 'instructions.status.completed' },
  failed: { color: 'error', labelKey: 'instructions.status.failed' },
};

type Props = {
  row: Instruction;
  canWrite: boolean;
  onGenerate: (instruction: Instruction) => void;
  onDelete: (instruction: Instruction) => void;
};

export default function InstructionTableRow({ row, canWrite, onGenerate, onDelete }: Props) {
  const { tx } = useLocales();
  const popover = usePopover();

  const statusMeta = GENERATION_STATUS_META[row.generationStatus];

  return (
    <>
      <TableRow hover>
        <TableCell>
          <Typography variant="subtitle2" noWrap>
            {row.title}
          </Typography>
        </TableCell>

        <TableCell>{row.specialtyName}</TableCell>

        <TableCell>
          <Label color={statusMeta.color}>{tx(statusMeta.labelKey)}</Label>
        </TableCell>

        <TableCell>{row.lastGeneratedAt ? fDateTime(row.lastGeneratedAt) : '—'}</TableCell>

        <TableCell>{fDate(row.createdAt)}</TableCell>

        <TableCell align="center">
          <Tooltip title={tx('instructions.actions.openFile')}>
            <IconButton component="a" href={row.file} target="_blank" rel="noopener noreferrer">
              <Iconify icon="eva:file-text-outline" />
            </IconButton>
          </Tooltip>
        </TableCell>

        {canWrite && (
          <TableCell align="right">
            <IconButton color={popover.open ? 'inherit' : 'default'} onClick={popover.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </TableCell>
        )}
      </TableRow>

      <CustomPopover open={popover.open} onClose={popover.onClose} arrow="right-top" sx={{ width: 200 }}>
        <MenuItem
          onClick={() => {
            popover.onClose();
            onGenerate(row);
          }}
        >
          <Iconify icon="solar:magic-stick-3-bold" />
          {tx('instructions.actions.generate')}
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
