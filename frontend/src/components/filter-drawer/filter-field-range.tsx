import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type Props = {
  label: string;
  minLabel?: string;
  maxLabel?: string;
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
};

export default function FilterFieldRange({
  label,
  minLabel = 'Min',
  maxLabel = 'Max',
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: Props) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{label}</Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          label={minLabel}
          type="number"
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
          inputProps={{ min: 0 }}
        />
        <TextField
          fullWidth
          size="small"
          label={maxLabel}
          type="number"
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
          inputProps={{ min: 0 }}
        />
      </Stack>
    </Stack>
  );
}
