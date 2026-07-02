import { useState } from 'react';
import * as Yup from 'yup';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
// @mui
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
// hooks
import { useAuthContext } from 'src/auth/hooks';
import { useBoolean } from 'src/hooks/use-boolean';
import useLocales from 'src/locales/use-locales';
// utils
import { getAuthFormErrorMessage } from 'src/utils/api-error-messages';
// config
import { PATH_AFTER_LOGIN } from 'src/config-global';
// components
import FormProvider, { RHFCheckbox, RHFTextField } from 'src/components/hook-form';
import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

type FormValues = {
  username: string;
  password: string;
  rememberMe: boolean;
};

export default function JwtLoginView() {
  const { login } = useAuthContext();
  const { tx } = useLocales();
  const [errorMsg, setErrorMsg] = useState('');
  const showPassword = useBoolean();

  const schema = Yup.object().shape({
    username: Yup.string().required(tx('common.validation.required')),
    password: Yup.string().required(tx('common.validation.required')),
    rememberMe: Yup.boolean().required(),
  });

  const methods = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: { username: '', password: '', rememberMe: false },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      setErrorMsg('');
      await login({ username: data.username, password: data.password }, data.rememberMe);
      window.location.href = PATH_AFTER_LOGIN;
    } catch (error) {
      setErrorMsg(getAuthFormErrorMessage(error));
    }
  });

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">{tx('common.auth.title')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {tx('common.auth.subtitle')}
        </Typography>
      </Stack>

      <FormProvider methods={methods} onSubmit={onSubmit}>
        <Stack spacing={2.5}>
          {!!errorMsg && (
            <Alert severity="error" onClose={() => setErrorMsg('')}>
              {errorMsg}
            </Alert>
          )}

          <RHFTextField name="username" label={tx('common.auth.username')} autoFocus />

          <RHFTextField
            name="password"
            label={tx('common.auth.password')}
            type={showPassword.value ? 'text' : 'password'}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={showPassword.onToggle} edge="end">
                    <Iconify
                      icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                    />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <RHFCheckbox name="rememberMe" label={tx('common.auth.rememberMe')} />

          <LoadingButton
            fullWidth
            color="inherit"
            size="large"
            type="submit"
            variant="contained"
            loading={isSubmitting}
          >
            {tx('common.auth.signIn')}
          </LoadingButton>
        </Stack>
      </FormProvider>
    </Stack>
  );
}
