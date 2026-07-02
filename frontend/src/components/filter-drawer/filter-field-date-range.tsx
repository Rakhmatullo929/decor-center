import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type Props = {
  label: string;
  fromLabel?: string;
  toLabel?: string;
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

export default function FilterFieldDateRange({
  label,
  fromLabel = 'From',
  toLabel = 'To',
  fromValue,
  toValue,
  onFromChange,
  onToChange,
}: Props) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{label}</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label={fromLabel}
          type="date"
          value={fromValue}
          onChange={(e) => onFromChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          fullWidth
          size="small"
          label={toLabel}
          type="date"
          value={toValue}
          onChange={(e) => onToChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>
    </Stack>
  );
}
