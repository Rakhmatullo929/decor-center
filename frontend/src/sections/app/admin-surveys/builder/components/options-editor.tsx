import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import useLocales from 'src/locales/use-locales';
import uuidv4 from 'src/utils/uuidv4';
import Iconify from 'src/components/iconify';

import type { TestOption } from '../../api/types';
import { defaultOptionText } from '../utils/question-type-meta';

type Props = {
  options: TestOption[];
  onChange: (options: TestOption[]) => void;
};

export default function OptionsEditor({ options, onChange }: Props) {
  const { tx, t } = useLocales();

  const setOptionText = (id: string, lang: 'uz' | 'ru', value: string) => {
    onChange(options.map((opt) => (opt.id === id ? { ...opt, text: { ...opt.text, [lang]: value } } : opt)));
  };

  const removeOption = (id: string) => {
    onChange(options.filter((opt) => opt.id !== id));
  };

  const addOption = () => {
    // The backend rejects options with blank text in both languages.
    onChange([...options, { id: uuidv4(), text: defaultOptionText(t, options.length) }]);
  };

  return (
    <Stack spacing={1.5}>
      {options.map((opt, index) => (
        <Stack key={opt.id} direction="row" spacing={1} alignItems="center">
          <TextField
            label={`${tx('surveys.builder.form.optionLabel', { n: index + 1 })  } (UZ)`}
            size="small"
            fullWidth
            value={opt.text.uz}
            onChange={(e) => setOptionText(opt.id, 'uz', e.target.value)}
          />
          <TextField
            label={`${tx('surveys.builder.form.optionLabel', { n: index + 1 })  } (RU)`}
            size="small"
            fullWidth
            value={opt.text.ru}
            onChange={(e) => setOptionText(opt.id, 'ru', e.target.value)}
          />
          <IconButton color="error" size="small" onClick={() => removeOption(opt.id)}>
            <Iconify icon="solar:trash-bin-trash-bold" width={18} />
          </IconButton>
        </Stack>
      ))}
      <Button
        size="small"
        startIcon={<Iconify icon="mingcute:add-line" />}
        onClick={addOption}
        sx={{ alignSelf: 'flex-start' }}
      >
        {tx('surveys.builder.actions.addOption')}
      </Button>
    </Stack>
  );
}
