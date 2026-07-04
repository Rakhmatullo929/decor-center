import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import type { LocalizedText } from '../../api/types';

type Props = {
  label: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  multiline?: boolean;
  size?: 'small' | 'medium';
};

export default function BilingualTextField({ label, value, onChange, multiline, size = 'small' }: Props) {
  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField
          label={`${label} (UZ)`}
          value={value.uz}
          onChange={(e) => onChange({ ...value, uz: e.target.value })}
          multiline={multiline}
          minRows={multiline ? 2 : undefined}
          size={size}
          fullWidth
        />
        <TextField
          label={`${label} (RU)`}
          value={value.ru}
          onChange={(e) => onChange({ ...value, ru: e.target.value })}
          multiline={multiline}
          minRows={multiline ? 2 : undefined}
          size={size}
          fullWidth
        />
      </Stack>
    </Stack>
  );
}
