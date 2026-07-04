import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import useLocales from 'src/locales/use-locales';

import type { Question } from '../../api/types';
import { EMPTY_LOCALIZED_TEXT } from '../../api/types';
import { QUESTION_TYPE_META } from '../utils/question-type-meta';
import BilingualTextField from './bilingual-text-field';
import FormFieldSettingsEditor from './form-field-settings-editor';
import OptionsEditor from './options-editor';
import ScaleSettingsEditor from './scale-settings-editor';

type Props = {
  question: Question;
  blockOptions: { id: number; label: string }[];
  onChange: (patch: Partial<Question>) => void;
  onMoveToBlock: (targetBlockId: number) => void;
};

export default function QuestionEditorPanel({ question, blockOptions, onChange, onMoveToBlock }: Props) {
  const { tx } = useLocales();
  const meta = QUESTION_TYPE_META[question.type];
  const isSectionHeader = question.type === 'section_header';

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <BilingualTextField
        label={tx('surveys.builder.form.text')}
        value={question.text}
        onChange={(text) => onChange({ text })}
        multiline={question.type === 'textarea'}
      />

      {(question.type === 'short_text' || question.type === 'textarea') && (
        <BilingualTextField
          label={tx('surveys.builder.form.placeholder')}
          value={question.settings.placeholder ?? EMPTY_LOCALIZED_TEXT}
          onChange={(placeholder) => onChange({ settings: { ...question.settings, placeholder } })}
        />
      )}

      {meta.hasOptions && (
        <OptionsEditor options={question.options} onChange={(options) => onChange({ options })} />
      )}

      {meta.hasScale && (question.type === 'nps' || question.type === 'scale5') && (
        <ScaleSettingsEditor
          type={question.type}
          settings={question.settings}
          onChange={(settings) => onChange({ settings })}
        />
      )}

      {question.type === 'form_field' && (
        <FormFieldSettingsEditor settings={question.settings} onChange={(settings) => onChange({ settings })} />
      )}

      {!isSectionHeader && (
        <>
          <Divider />
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <FormControlLabel
              control={
                <Switch
                  checked={question.isRequired}
                  onChange={(e) => onChange({ isRequired: e.target.checked })}
                />
              }
              label={tx('surveys.builder.form.required')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={question.isMindDive}
                  onChange={(e) => onChange({ isMindDive: e.target.checked })}
                />
              }
              label={tx('surveys.builder.form.mindDive')}
            />
          </Stack>
        </>
      )}

      {blockOptions.length > 0 && (
        <TextField
          select
          size="small"
          label={tx('surveys.builder.form.moveToBlock')}
          value=""
          onChange={(e) => onMoveToBlock(Number(e.target.value))}
          sx={{ maxWidth: 280 }}
        >
          {blockOptions.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              {b.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  );
}
