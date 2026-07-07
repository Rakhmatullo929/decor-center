import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import useLocales from 'src/locales/use-locales';

import type { QuestionSettings } from '../../api/types';

type Props = {
  settings: QuestionSettings;
  onChange: (settings: QuestionSettings) => void;
};

export default function FormFieldSettingsEditor({ settings, onChange }: Props) {
  const { tx } = useLocales();
  const fieldType = settings.fieldType ?? 'text';

  return (
    <Stack spacing={1.5}>
      <TextField
        select
        size="small"
        label={tx('surveys.builder.form.fieldType')}
        value={fieldType}
        onChange={(e) => onChange({ ...settings, fieldType: e.target.value as 'text' | 'date' })}
        sx={{ maxWidth: 200 }}
      >
        <MenuItem value="text">{tx('surveys.builder.form.fieldTypeText')}</MenuItem>
        <MenuItem value="date">{tx('surveys.builder.form.fieldTypeDate')}</MenuItem>
      </TextField>
      <TextField
        size="small"
        label={tx('surveys.builder.form.placeholder')}
        value={settings.placeholder ?? ''}
        onChange={(e) => onChange({ ...settings, placeholder: e.target.value })}
        fullWidth
      />
    </Stack>
  );
}
