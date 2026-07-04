import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import useLocales from 'src/locales/use-locales';

import type { QuestionSettings } from '../../api/types';
import { EMPTY_LOCALIZED_TEXT } from '../../api/types';
import BilingualTextField from './bilingual-text-field';

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
      <BilingualTextField
        label={tx('surveys.builder.form.placeholder')}
        value={settings.placeholder ?? EMPTY_LOCALIZED_TEXT}
        onChange={(placeholder) => onChange({ ...settings, placeholder })}
      />
    </Stack>
  );
}
