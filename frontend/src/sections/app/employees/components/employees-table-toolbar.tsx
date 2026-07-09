// @mui
import Button from '@mui/material/Button';
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
  status: string;
  onStatus: (value: string) => void;
  specialtyOptions: Specialty[];
};

export default function EmployeesTableToolbar({
  search,
  onSearch,
  specialty,
  onSpecialty,
  status,
  onStatus,
  specialtyOptions,
}: Props) {
  const { tx } = useLocales();

  const hasFilters = !!search || !!specialty || !!status;

  const handleReset = () => {
    onSearch('');
    onSpecialty('');
    onStatus('');
  };

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={2}
      sx={{ p: 2.5 }}
    >
      <TextField
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={tx('employees.searchPlaceholder')}
        size="small"
        fullWidth
        sx={{ maxWidth: { sm: 280 } }}
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
        label={tx('employees.filters.specialty')}
        value={specialty}
        onChange={(event) => onSpecialty(event.target.value)}
        sx={{ width: { xs: 1, sm: 220 }, flexShrink: 0 }}
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
        label={tx('employees.filters.status')}
        value={status}
        onChange={(event) => onStatus(event.target.value)}
        sx={{ width: { xs: 1, sm: 160 }, flexShrink: 0 }}
      >
        <MenuItem value="">{tx('common.labels.all')}</MenuItem>
        <MenuItem value="true">{tx('common.status.active')}</MenuItem>
        <MenuItem value="false">{tx('common.status.inactive')}</MenuItem>
      </TextField>

      {hasFilters && (
        <Button
          color="inherit"
          size="small"
          onClick={handleReset}
          startIcon={<Iconify icon="solar:restart-bold" />}
          sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          {tx('common.actions.reset')}
        </Button>
      )}
    </Stack>
  );
}
