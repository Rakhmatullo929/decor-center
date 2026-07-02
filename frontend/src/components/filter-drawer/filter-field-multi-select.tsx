import Autocomplete from '@mui/material/Autocomplete';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';

// ----------------------------------------------------------------------

type Option = {
  value: string;
  label: string;
};

type Props = {
  label: string;
  placeholder?: string;
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
};

export default function FilterFieldMultiSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
}: Props) {
  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={options}
      value={selectedOptions}
      getOptionLabel={(opt) => opt.label}
      isOptionEqualToValue={(opt, val) => opt.value === val.value}
      onChange={(_, newValue) => onChange(newValue.map((opt) => opt.value))}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
          {option.label}
        </li>
      )}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            {...getTagProps({ index })}
            key={option.value}
            label={option.label}
            size="small"
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={selectedOptions.length === 0 ? placeholder : undefined}
          size="small"
        />
      )}
    />
  );
}
