import Stack from '@mui/material/Stack';

import { paths } from 'src/routes/paths';
import { AccountPopover, LanguagePopover } from 'src/layouts/_common';

// ----------------------------------------------------------------------

/** Employee cabinet header actions: language switch + account/logout. Logout sends the
 * employee back to /scan (face+OTP), not the admin /login form. */
export default function EmployeeTopbar() {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <LanguagePopover />
      <AccountPopover logoutRedirectTo={paths.scan} />
    </Stack>
  );
}
