import { useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import useLocales from 'src/locales/use-locales';

type Props = {
  phoneMasked: string;
  isVerifying: boolean;
  errorText: string | null;
  onVerify: (code: string) => void;
  onBack: () => void;
};

export default function OtpStep({ phoneMasked, isVerifying, errorText, onVerify, onBack }: Props) {
  const { tx } = useLocales();
  const [code, setCode] = useState('');
  const canSubmit = code.trim().length >= 4 && !isVerifying;

  return (
    <Stack spacing={3} alignItems="center" textAlign="center" sx={{ py: { xs: 5, md: 8 } }}>
      <Typography variant="h4">{tx('survey.kiosk.otp.title')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {tx('survey.kiosk.otp.sentTo', { phone: phoneMasked })}
      </Typography>

      <TextField
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="0000"
        inputProps={{
          inputMode: 'numeric',
          'aria-label': tx('survey.kiosk.otp.title'),
          style: { fontSize: 32, letterSpacing: 12, textAlign: 'center' },
        }}
        error={!!errorText}
        helperText={errorText ?? ' '}
        sx={{ width: 220 }}
        autoFocus
      />

      <Stack direction="row" spacing={2}>
        <Button variant="outlined" color="inherit" size="large" onClick={onBack} disabled={isVerifying}>
          {tx('common.actions.back')}
        </Button>
        <Button variant="contained" size="large" disabled={!canSubmit} onClick={() => onVerify(code)}>
          {tx('survey.kiosk.otp.verify')}
        </Button>
      </Stack>
    </Stack>
  );
}
