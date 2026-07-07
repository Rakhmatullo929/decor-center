import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import useLocales from 'src/locales/use-locales';

import type { QuestionSettings, QuestionType } from '../../api/types';

type Props = {
  type: Extract<QuestionType, 'nps' | 'scale5'>;
  settings: QuestionSettings;
  onChange: (settings: QuestionSettings) => void;
};

export default function ScaleSettingsEditor({ type, settings, onChange }: Props) {
  const { tx } = useLocales();
  const min = settings.min ?? (type === 'nps' ? 0 : 1);

  return (
    <Stack spacing={1.5}>
      {type === 'nps' && (
        <TextField
          select
          size="small"
          label={tx('surveys.builder.form.scaleStart')}
          value={min}
          onChange={(e) => onChange({ ...settings, min: Number(e.target.value) })}
          sx={{ maxWidth: 160 }}
        >
          <MenuItem value={0}>0–10</MenuItem>
          <MenuItem value={1}>1–10</MenuItem>
        </TextField>
      )}
      {type === 'scale5' && (
        <TextField size="small" label={tx('surveys.builder.form.scaleRange')} value="1–5" disabled sx={{ maxWidth: 160 }} />
      )}
      <TextField
        size="small"
        label={tx('surveys.builder.form.leftLabel')}
        value={settings.leftLabel ?? ''}
        onChange={(e) => onChange({ ...settings, leftLabel: e.target.value })}
        fullWidth
      />
      <TextField
        size="small"
        label={tx('surveys.builder.form.rightLabel')}
        value={settings.rightLabel ?? ''}
        onChange={(e) => onChange({ ...settings, rightLabel: e.target.value })}
        fullWidth
      />
    </Stack>
  );
}
