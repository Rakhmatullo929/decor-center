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

// ----------------------------------------------------------------------

type Props = {
  search: string;
  onSearch: (value: string) => void;
  specialty: string;
  onSpecialty: (value: string) => void;
  generationStatus: string;
  onGenerationStatus: (value: string) => void;
  specialtyOptions: Specialty[];
};

export default function InstructionsTableToolbar({
  search,
  onSearch,
  specialty,
  onSpecialty,
  generationStatus,
  onGenerationStatus,
  specialtyOptions,
}: Props) {
  const { tx } = useLocales();

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2.5 }}>
      <TextField
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={tx('instructions.searchPlaceholder')}
        size="small"
        sx={{ width: { xs: 1, sm: 320 } }}
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
        label={tx('instructions.filters.specialty')}
        value={specialty}
        onChange={(event) => onSpecialty(event.target.value)}
        sx={{ width: { xs: 1, sm: 240 } }}
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
        label={tx('instructions.filters.generationStatus')}
        value={generationStatus}
        onChange={(event) => onGenerationStatus(event.target.value)}
        sx={{ width: { xs: 1, sm: 220 } }}
      >
        <MenuItem value="">{tx('common.labels.all')}</MenuItem>
        <MenuItem value="not_started">{tx('instructions.status.notStarted')}</MenuItem>
        <MenuItem value="completed">{tx('instructions.status.completed')}</MenuItem>
        <MenuItem value="failed">{tx('instructions.status.failed')}</MenuItem>
      </TextField>
    </Stack>
  );
}
