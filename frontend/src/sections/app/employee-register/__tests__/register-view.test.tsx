import { Route, Routes } from 'react-router-dom';

import { render, screen } from 'src/test-utils';

import EmployeeRegisterView from '../register-view';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

// error-reader imports axios; mock it like the other component tests.
jest.mock('src/utils/error-reader', () => ({ errorReader: () => 'mock-error' }));

const mockValidate = jest.fn();
jest.mock('../../employees/api/employee-invites-requests', () => ({
  validateInvite: (token: string) => mockValidate(token),
}));

jest.mock('../../employees/api/use-employee-invites-api', () => ({
  useRegisterEmployeeMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// FaceCapture needs no camera in these tests.
jest.mock('../face-capture', () => ({
  __esModule: true,
  default: () => <div data-testid="face-capture" />,
}));

// test-utils already provides a MemoryRouter — pass the URL via routerEntries, and
// supply the :token Route so useParams resolves. Do NOT nest another Router.
function renderAt(token: string) {
  return render(
    <Routes>
      <Route path="/register/:token" element={<EmployeeRegisterView />} />
    </Routes>,
    { routerEntries: [`/register/${token}`] }
  );
}

describe('EmployeeRegisterView', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an error state for an invalid token', async () => {
    mockValidate.mockResolvedValue({ valid: false, reason: 'used' });
    renderAt('BAD');
    expect(await screen.findByText('employees.register.invalid.used')).toBeInTheDocument();
  });

  it('shows the form for a valid token', async () => {
    mockValidate.mockResolvedValue({ valid: true, reason: 'ok', specialtyName: 'Designer' });
    renderAt('GOOD');
    expect(await screen.findByText('employees.register.submit')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Designer')).toBeInTheDocument();
    expect(screen.getByTestId('face-capture')).toBeInTheDocument();
  });
});
