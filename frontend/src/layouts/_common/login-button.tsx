// @mui
import { Theme, SxProps } from '@mui/material/styles';
import Button from '@mui/material/Button';
// routes
import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

// ----------------------------------------------------------------------

type Props = {
  sx?: SxProps<Theme>;
};

export default function LoginButton({ sx }: Props) {
  const loginPath = paths.login;

  return (
    <Button component={RouterLink} href={loginPath} variant="outlined" sx={{ mr: 1, ...sx }}>
      Login
    </Button>
  );
}
