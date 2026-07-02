import { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
// hooks
import { useDebounce } from 'src/hooks/use-debounce';
import useLocales from 'src/locales/use-locales';
// components
import Iconify from 'src/components/iconify';
//
import type { Employee } from '../../employees/api/types';
import { useSpecialtyOptionsQuery } from '../../specialties/api/use-specialties-api';
import { useEmployeeFilterOptionsQuery, useEmployeeFilterValueQuery } from '../api/use-results-api';

// ----------------------------------------------------------------------

type Props = {
  employee: string;
  onEmployee: (value: string) => void;
  /** The specialty filter only applies to the `specialty` module tab. */
  showSpecialty: boolean;
  specialty: string;
  onSpecialty: (value: string) => void;
  passed: string;
  onPassed: (value: string) => void;
  date: string;
  onDate: (value: string) => void;
  onExport: VoidFunction;
  exporting: boolean;
};

export default function ResultsTableToolbar({
  employee,
  onEmployee,
  showSpecialty,
  specialty,
  onSpecialty,
  passed,
  onPassed,
  date,
  onDate,
  onExport,
  exporting,
}: Props) {
  const { tx } = useLocales();

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = useMemo(
    () => specialtyOptionsQuery.data?.results ?? [],
    [specialtyOptionsQuery.data?.results]
  );

  const employeeId = employee ? Number(employee) : null;

  const [employeeInput, setEmployeeInput] = useState('');
  const debouncedEmployeeInput = useDebounce(employeeInput, 400);

  const optionsQuery = useEmployeeFilterOptionsQuery(debouncedEmployeeInput);
  const options = useMemo(() => optionsQuery.data?.results ?? [], [optionsQuery.data?.results]);

  const selectedEmployeeQuery = useEmployeeFilterValueQuery(employeeId);

  const selectedEmployee = useMemo<Employee | null>(() => {
    if (employeeId === null) return null;
    return (
      options.find((option) => option.id === employeeId) ?? selectedEmployeeQuery.data ?? null
    );
  }, [employeeId, options, selectedEmployeeQuery.data]);

  const mergedOptions = useMemo(() => {
    if (selectedEmployee && !options.some((option) => option.id === selectedEmployee.id)) {
      return [selectedEmployee, ...options];
    }
    return options;
  }, [options, selectedEmployee]);

  const dateValue = useMemo<Date | null>(() => {
    if (!date) return null;
    const parsed = parseISO(date);
    return isValid(parsed) ? parsed : null;
  }, [date]);

  const handleDateChange = (value: Date | null) => {
    onDate(value && isValid(value) ? format(value, 'yyyy-MM-dd') : '');
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2.5 }}>
      <Autocomplete
        size="small"
        sx={{ width: { xs: 1, sm: 280 } }}
        options={mergedOptions}
        value={selectedEmployee}
        loading={optionsQuery.isFetching}
        filterOptions={(items) => items}
        getOptionLabel={(option) => option.fullName}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_event, value) => onEmployee(value ? String(value.id) : '')}
        onInputChange={(_event, value) => setEmployeeInput(value)}
        noOptionsText={tx('common.table.noData')}
        renderInput={(params) => <TextField {...params} label={tx('results.filters.employee')} />}
      />

      {showSpecialty && (
        <TextField
          select
          size="small"
          label={tx('results.filters.specialty')}
          value={specialty}
          onChange={(event) => onSpecialty(event.target.value)}
          sx={{ width: { xs: 1, sm: 220 } }}
        >
          <MenuItem value="">{tx('common.labels.all')}</MenuItem>
          {specialtyOptions.map((option) => (
            <MenuItem key={option.id} value={String(option.id)}>
              {option.name}
            </MenuItem>
          ))}
        </TextField>
      )}

      <TextField
        select
        size="small"
        label={tx('results.filters.result')}
        value={passed}
        onChange={(event) => onPassed(event.target.value)}
        sx={{ width: { xs: 1, sm: 160 } }}
      >
        <MenuItem value="">{tx('common.labels.all')}</MenuItem>
        <MenuItem value="true">{tx('common.status.passed')}</MenuItem>
        <MenuItem value="false">{tx('common.status.failed')}</MenuItem>
      </TextField>

      <DatePicker
        label={tx('results.filters.date')}
        value={dateValue}
        onChange={handleDateChange}
        slotProps={{ textField: { size: 'small', sx: { width: { xs: 1, sm: 180 } } }, actionBar: { actions: ['clear'] } }}
      />

      <Box sx={{ flexGrow: 1 }} />

      <LoadingButton
        variant="outlined"
        color="inherit"
        loading={exporting}
        startIcon={<Iconify icon="eva:download-fill" />}
        onClick={onExport}
      >
        {tx('common.actions.export')}
      </LoadingButton>
    </Stack>
  );
}
