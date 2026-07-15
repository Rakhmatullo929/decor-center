import { useEffect, useState } from 'react';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
// hooks
import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';
import useLocales from 'src/locales/use-locales';
// utils
import { fDate } from 'src/utils/format-time';
// components
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
//
import { useSpecialtyOptionsQuery } from '../../specialties/api/use-specialties-api';
import { useCreateInviteMutation } from '../api/use-employee-invites-api';

type Props = {
  open: boolean;
  onClose: VoidFunction;
};

export default function InviteEmployeeDialog({ open, onClose }: Props) {
  const { tx } = useLocales();
  const { enqueueSnackbar } = useSnackbar();
  const { copy } = useCopyToClipboard();

  const specialtyOptionsQuery = useSpecialtyOptionsQuery();
  const specialtyOptions = specialtyOptionsQuery.data?.results ?? [];

  const createMutation = useCreateInviteMutation();

  const [specialty, setSpecialty] = useState<number | ''>('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSpecialty('');
      setInviteUrl(null);
      setExpiresAt(null);
    }
  }, [open]);

  const handleGenerate = () => {
    if (specialty === '') return;
    createMutation.mutate(Number(specialty), {
      onSuccess: (data) => {
        setInviteUrl(`${window.location.origin}/register/${data.token}`);
        setExpiresAt(data.expiresAt);
      },
    });
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    const ok = await copy(inviteUrl);
    if (ok) enqueueSnackbar(tx('employees.invite.copied'));
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle>{tx('employees.invite.title')}</DialogTitle>

      <DialogContent>
        {!inviteUrl ? (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {tx('employees.invite.description')}
            </Typography>
            <TextField
              select
              fullWidth
              label={`${tx('employees.form.specialty')} *`}
              value={specialty === '' ? '' : String(specialty)}
              onChange={(event) => setSpecialty(Number(event.target.value))}
            >
              {specialtyOptions.map((option) => (
                <MenuItem key={option.id} value={String(option.id)}>
                  {option.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="success">{tx('employees.invite.ready')}</Alert>
            <TextField
              fullWidth
              value={inviteUrl}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleCopy} edge="end" aria-label={tx('employees.invite.copied')}>
                      <Iconify icon="solar:copy-bold" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {expiresAt && (
              <Typography variant="caption" color="text.secondary">
                {tx('employees.invite.expires', { date: fDate(expiresAt) })}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          {tx('employees.invite.close')}
        </Button>
        {!inviteUrl && (
          <LoadingButton
            variant="contained"
            loading={createMutation.isPending}
            disabled={specialty === ''}
            onClick={handleGenerate}
          >
            {tx('employees.invite.generate')}
          </LoadingButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
