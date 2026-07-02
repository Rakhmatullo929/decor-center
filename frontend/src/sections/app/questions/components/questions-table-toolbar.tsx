// @mui
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
// hooks
import useLocales from 'src/locales/use-locales';
// components
import Iconify from 'src/components/iconify';
//
import type { Specialty } from '../../specialties/api/types';
import { QUESTION_MODULES, QUESTION_MODULE_LABELS } from './utils/question-constants';

// ----------------------------------------------------------------------

type Props = {
  search: string;
  onSearch: (value: string) => void;
  module: string;
  onModule: (value: string) => void;
  specialty: string;
  onSpecialty: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  source: string;
  onSource: (value: string) => void;
  specialtyOptions: Specialty[];
};

export default function QuestionsTableToolbar({
  search,
  onSearch,
  module,
  onModule,
  specialty,
  onSpecialty,
  status,
  onStatus,
  source,
  onSource,
  specialtyOptions,
}: Props) {
  const { tx } = useLocales();

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2}
      sx={{ p: 2.5, flexWrap: { md: 'wrap' } }}
    >
      <TextField
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={tx('questions.searchPlaceholder')}
        size="small"
        sx={{ width: { xs: 1, md: 280 } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        select
        size="small"
        label={tx('questions.filters.module')}
        value={module}
        onChange={(event) => onModule(event.target.value)}
        sx={{ width: { xs: 1, md: 220 } }}
      >
        <MenuItem value="">{tx('common.labels.all')}</MenuItem>
        {QUESTION_MODULES.map((option) => (
          <MenuItem key={option} value={option}>
            {tx(QUESTION_MODULE_LABELS[option])}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label={tx('questions.filters.specialty')}
        value={specialty}
        onChange={(event) => onSpecialty(event.target.value)}
        sx={{ width: { xs: 1, md: 220 } }}
      >
        <MenuItem value="">{tx('common.labels.all')}</MenuItem>
        {specialtyOptions.map((option) => (
          <MenuItem key={option.id} value={String(option.id)}>
            {option.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        label={tx('questions.filters.status')}
        value={status}
        onChange={(event) => onStatus(event.target.value)}
        sx={{ width: { xs: 1, md: 180 } }}
      >
        <MenuItem value="">{tx('common.labels.all')}</MenuItem>
        <MenuItem value="draft">{tx('common.status.draft')}</MenuItem>
        <MenuItem value="approved">{tx('common.status.approved')}</MenuItem>
      </TextField>

      <TextField
        select
        size="small"
        label={tx('questions.filters.source')}
        value={source}
        onChange={(event) => onSource(event.target.value)}
        sx={{ width: { xs: 1, md: 160 } }}
      >
        <MenuItem value="">{tx('common.labels.all')}</MenuItem>
        <MenuItem value="ai">{tx('questions.source.ai')}</MenuItem>
        <MenuItem value="manual">{tx('questions.source.manual')}</MenuItem>
      </TextField>
    </Stack>
  );
}
