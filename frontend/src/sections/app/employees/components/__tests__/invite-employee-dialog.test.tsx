import userEvent from '@testing-library/user-event';

import { render, screen } from 'src/test-utils';

import InviteEmployeeDialog from '../invite-employee-dialog';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

// useSnackbar is called at render; mock it (no SnackbarProvider in test-utils).
jest.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
}));

const mockMutate = jest.fn();
// The mock fires onSuccess synchronously so the success view renders inside act().
jest.mock('../../api/use-employee-invites-api', () => ({
  useCreateInviteMutation: () => ({
    mutate: (specialty: number, opts: { onSuccess?: (d: unknown) => void }) => {
      mockMutate(specialty);
      opts?.onSuccess?.({ token: 'TOKEN123', expiresAt: '2026-07-22T10:00:00Z' });
    },
    isPending: false,
  }),
}));

jest.mock('../../../specialties/api/use-specialties-api', () => ({
  useSpecialtyOptionsQuery: () => ({ data: { results: [{ id: 3, name: 'Designer' }] } }),
}));

describe('InviteEmployeeDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates a link and shows the copyable URL', async () => {
    const user = userEvent.setup();
    render(<InviteEmployeeDialog open onClose={jest.fn()} />);

    // open the MUI select (role=button, named by its label) and pick "Designer"
    await user.click(screen.getByRole('button', { name: /employees\.form\.specialty/ }));
    await user.click(await screen.findByRole('option', { name: 'Designer' }));

    await user.click(screen.getByText('employees.invite.generate'));

    expect(mockMutate).toHaveBeenCalledWith(3);
    expect(await screen.findByDisplayValue(/register\/TOKEN123$/)).toBeInTheDocument();
  });
});
