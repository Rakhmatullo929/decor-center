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
import { useMedicalEmployeeOptionsQuery, useMedicalEmployeeValueQuery } from '../api/use-medical-api';

// ----------------------------------------------------------------------

type Props = {
  employee: string;
  onEmployee: (value: string) => void;
  conclusion: string;
  onConclusion: (value: string) => void;
  date: string;
  onDate: (value: string) => void;
  onExport: VoidFunction;
  exporting: boolean;
};

export default function MedicalTableToolbar({
  employee,
  onEmployee,
  conclusion,
  onConclusion,
  date,
  onDate,
  onExport,
  exporting,
}: Props) {
  const { tx } = useLocales();

  const employeeId = employee ? Number(employee) : null;

  const [employeeInput, setEmployeeInput] = useState('');
  const debouncedEmployeeInput = useDebounce(employeeInput, 400);

  const optionsQuery = useMedicalEmployeeOptionsQuery(debouncedEmployeeInput);
  const options = useMemo(() => optionsQuery.data?.results ?? [], [optionsQuery.data?.results]);

  const selectedEmployeeQuery = useMedicalEmployeeValueQuery(employeeId);

  const selectedEmployee = useMemo<Employee | null>(() => {
    if (employeeId === null) return null;
    return (
      options.find((opt) => opt.id === employeeId) ?? selectedEmployeeQuery.data ?? null
    );
  }, [employeeId, options, selectedEmployeeQuery.data]);

  const mergedOptions = useMemo(() => {
    if (selectedEmployee && !options.some((opt) => opt.id === selectedEmployee.id)) {
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
        renderInput={(params) => (
          <TextField {...params} label={tx('medical.filters.employee')} />
        )}
      />

      <TextField
        select
        size="small"
        label={tx('medical.filters.conclusion')}
        value={conclusion}
        onChange={(event) => onConclusion(event.target.value)}
        sx={{ width: { xs: 1, sm: 200 } }}
      >
        <MenuItem value="">{tx('common.labels.all')}</MenuItem>
        <MenuItem value="approved">{tx('medical.conclusion.approved')}</MenuItem>
        <MenuItem value="rejected">{tx('medical.conclusion.rejected')}</MenuItem>
      </TextField>

      <DatePicker
        label={tx('medical.filters.date')}
        value={dateValue}
        onChange={handleDateChange}
        slotProps={{
          textField: { size: 'small', sx: { width: { xs: 1, sm: 180 } } },
          actionBar: { actions: ['clear'] },
        }}
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
