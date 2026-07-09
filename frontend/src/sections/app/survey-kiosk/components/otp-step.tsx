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
    <Stack spacing={3} alignItems="center" textAlign="center">
      <Stack spacing={0.5} alignItems="center">
        <Typography variant="h4">{tx('survey.kiosk.otp.title')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {tx('survey.kiosk.otp.sentTo', { phone: phoneMasked })}
        </Typography>
      </Stack>

      <TextField
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="0000"
        inputProps={{
          inputMode: 'numeric',
          'aria-label': tx('survey.kiosk.otp.title'),
          style: { fontSize: 28, letterSpacing: 12, textAlign: 'center' },
        }}
        error={!!errorText}
        helperText={errorText ?? ' '}
        sx={{ width: 1, maxWidth: 220 }}
        autoFocus
      />

      <Stack direction="row" spacing={2} sx={{ width: 1 }}>
        <Button fullWidth variant="outlined" color="inherit" onClick={onBack} disabled={isVerifying}>
          {tx('common.actions.back')}
        </Button>
        <Button fullWidth variant="contained" disabled={!canSubmit} onClick={() => onVerify(code)}>
          {tx('survey.kiosk.otp.verify')}
        </Button>
      </Stack>
    </Stack>
  );
}
