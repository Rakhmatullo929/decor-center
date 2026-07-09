import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useDebounce } from 'src/hooks/use-debounce';
import useLocales from 'src/locales/use-locales';

import { useEmployeesLookupQuery } from '../api/use-survey-kiosk-api';
import type { EmployeeLookupItem } from '../api/types';

type Props = {
  onPick: (item: EmployeeLookupItem) => void;
  onBack: () => void;
};

export default function ManualPickStep({ onPick, onBack }: Props) {
  const { tx } = useLocales();
  const [term, setTerm] = useState('');
  const q = useDebounce(term, 350);
  const query = useEmployeesLookupQuery(q);
  const items = query.data ?? [];

  return (
    <Stack spacing={3}>
      <Typography variant="h4" textAlign="center">
        {tx('survey.kiosk.manual.title')}
      </Typography>

      <TextField
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={tx('survey.kiosk.manual.searchPlaceholder')}
        autoFocus
      />

      <Box sx={{ minHeight: 240 }}>
        {query.isFetching && q.trim().length >= 2 && (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={24} />
          </Stack>
        )}
        <List disablePadding>
          {items.map((item) => (
            <ListItemButton key={item.id} onClick={() => onPick(item)} sx={{ borderRadius: 1 }}>
              <ListItemText primary={item.fullName} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Button fullWidth variant="outlined" color="inherit" onClick={onBack}>
        {tx('survey.kiosk.manual.backToCamera')}
      </Button>
    </Stack>
  );
}
