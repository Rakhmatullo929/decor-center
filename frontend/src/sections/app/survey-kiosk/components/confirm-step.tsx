import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import useLocales from 'src/locales/use-locales';

import type { KioskEmployee } from '../api/types';

type Props = {
  employee: KioskEmployee;
  isSending: boolean;
  onSendCode: () => void;
  onRescan: () => void;
};

export default function ConfirmStep({ employee, isSending, onSendCode, onRescan }: Props) {
  const { tx } = useLocales();

  return (
    <Stack spacing={3} alignItems="center" textAlign="center">
      <Avatar
        src={employee.photo ?? undefined}
        alt={employee.fullName}
        sx={{ width: 88, height: 88, fontSize: 32 }}
      >
        {employee.fullName.charAt(0).toUpperCase()}
      </Avatar>

      <Stack spacing={0.5}>
        <Typography variant="h5">{employee.fullName}</Typography>
        {!!employee.specialtyName && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {employee.specialtyName}
          </Typography>
        )}
      </Stack>

      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {tx('survey.kiosk.confirm.sendPrompt', { phone: employee.phoneMasked })}
      </Typography>

      <Stack direction="row" spacing={2} sx={{ width: 1, pt: 1 }}>
        <Button fullWidth variant="outlined" color="inherit" onClick={onRescan} disabled={isSending}>
          {tx('survey.kiosk.confirm.notMe')}
        </Button>
        <Button fullWidth variant="contained" onClick={onSendCode} disabled={isSending}>
          {tx('survey.kiosk.confirm.sendCode')}
        </Button>
      </Stack>
    </Stack>
  );
}
