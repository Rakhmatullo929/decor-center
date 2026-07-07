import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Iconify from 'src/components/iconify';

import type { LocalizedText } from '../../api/types';

type Props = {
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  multiline?: boolean;
  size?: 'small' | 'medium';
  /** Show a flag icon instead of a "(UZ)/(RU)" text suffix — reads faster once
   * you know the pattern, and keeps the label itself uncluttered. */
  showFlagIcons?: boolean;
};

export default function BilingualTextField({
  label,
  value,
  onChange,
  multiline,
  size = 'small',
  showFlagIcons,
}: Props) {
  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          label={showFlagIcons ? label : `${label} (UZ)`}
          value={value.uz}
          onChange={(e) => onChange({ ...value, uz: e.target.value })}
          multiline={multiline}
          minRows={multiline ? 2 : undefined}
          size={size}
          fullWidth
          inputProps={{ 'aria-label': `${label} (UZ)` }}
          InputProps={
            showFlagIcons
              ? {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="flagpack:uz" width={20} sx={{ borderRadius: 0.5 }} />
                    </InputAdornment>
                  ),
                }
              : undefined
          }
        />
        <TextField
          label={showFlagIcons ? label : `${label} (RU)`}
          value={value.ru}
          onChange={(e) => onChange({ ...value, ru: e.target.value })}
          multiline={multiline}
          minRows={multiline ? 2 : undefined}
          size={size}
          fullWidth
          inputProps={{ 'aria-label': `${label} (RU)` }}
          InputProps={
            showFlagIcons
              ? {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="flagpack:ru" width={20} sx={{ borderRadius: 0.5 }} />
                    </InputAdornment>
                  ),
                }
              : undefined
          }
        />
      </Stack>
    </Stack>
  );
}
