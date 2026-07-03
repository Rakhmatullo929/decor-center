import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';

import { render, screen, within } from 'src/test-utils';

import type { Employee } from '../api/types';
import EmployeesView from '../view';

// ----------------------------------------------------------------------

const mockEnqueueSnackbar = jest.fn();
const mockPermissions = jest.fn();
const mockUseEmployeesQuery = jest.fn();
const mockUseSpecialtyOptionsQuery = jest.fn();

const mockToggleMutation = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
const mockCreateMutation = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };
const mockUpdateMutation = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false };

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

jest.mock('src/auth/hooks', () => ({
  useCheckPermission: () => mockPermissions(),
}));

jest.mock('src/components/settings', () => ({
  useSettingsContext: () => ({ themeStretch: false }),
}));

jest.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

jest.mock('src/components/scrollbar', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// error-reader (used by the upsert dialog) imports axios (ESM) which CRA's Jest cannot transform.
jest.mock('src/utils/error-reader', () => ({
  errorReader: () => 'mock-error',
}));

jest.mock('../api/use-employees-api', () => ({
  useEmployeesQuery: (...args: unknown[]) => mockUseEmployeesQuery(...args),
  useToggleEmployeeActiveMutation: () => mockToggleMutation,
  useCreateEmployeeMutation: () => mockCreateMutation,
  useUpdateEmployeeMutation: () => mockUpdateMutation,
}));

jest.mock('../../specialties/api/use-specialties-api', () => ({
  useSpecialtyOptionsQuery: () => mockUseSpecialtyOptionsQuery(),
}));

// FacePhotosDialog (rendered by the view) pulls in the face-photos hooks → src/hooks/api → axios (ESM).
jest.mock('../api/use-face-photos-api', () => ({
  useFacePhotosQuery: () => ({ data: [], isPending: false, refetch: jest.fn() }),
  useAddFacePhotoMutation: () => ({ mutateAsync: jest.fn() }),
  useDeleteFacePhotoMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

// ----------------------------------------------------------------------

const activeEmployee: Employee = {
  id: 1,
  fullName: 'Alisher Karimov',
  specialty: 3,
  specialtyName: 'Electrician',
  photo: null,
  isActive: true,
  hireDate: null,
  workExperience: null,
  createdAt: '2026-01-15T10:00:00Z',
};

const archivedEmployee: Employee = {
  id: 2,
  fullName: 'Bobur Toshev',
  specialty: 4,
  specialtyName: 'Welder',
  photo: null,
  isActive: false,
  hireDate: null,
  workExperience: null,
  createdAt: '2026-02-20T10:00:00Z',
};

function mockEmployeesData(results: Employee[], extra?: Partial<Record<string, unknown>>) {
  mockUseEmployeesQuery.mockReturnValue({
    data: { results, count: results.length },
    isPending: false,
    isFetching: false,
    addItem: jest.fn(),
    updateItem: jest.fn(),
    ...extra,
  });
}

describe('EmployeesView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions.mockReturnValue({ canWritePage: jest.fn(() => true) });
    mockUseSpecialtyOptionsQuery.mockReturnValue({
      data: { results: [], count: 0 },
      isPending: false,
    });
    mockEmployeesData([]);
  });

  it('shows skeleton rows while the list is pending', () => {
    mockUseEmployeesQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
      addItem: jest.fn(),
      updateItem: jest.fn(),
    });

    const { container } = render(<EmployeesView />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('employees.empty')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no results', () => {
    mockEmployeesData([]);

    render(<EmployeesView />);

    expect(screen.getByText('employees.empty')).toBeInTheDocument();
  });

  it('renders data rows with name, specialty and status keys', () => {
    mockEmployeesData([activeEmployee, archivedEmployee]);

    render(<EmployeesView />);

    expect(screen.getByText('Alisher Karimov')).toBeInTheDocument();
    expect(screen.getByText('Electrician')).toBeInTheDocument();
    expect(screen.getByText('common.status.active')).toBeInTheDocument();
    expect(screen.getByText('Bobur Toshev')).toBeInTheDocument();
    expect(screen.getByText('common.status.inactive')).toBeInTheDocument();
    expect(screen.queryByText('employees.empty')).not.toBeInTheDocument();
  });

  it('renders the search input', () => {
    render(<EmployeesView />);

    expect(screen.getByPlaceholderText('employees.searchPlaceholder')).toBeInTheDocument();
  });

  it('shows the create button when employees:write is granted', () => {
    render(<EmployeesView />);

    expect(screen.getByText('employees.actions.create')).toBeInTheDocument();
  });

  it('hides the create button and row actions without employees:write', () => {
    mockPermissions.mockReturnValue({ canWritePage: jest.fn(() => false) });
    mockEmployeesData([activeEmployee]);

    render(<EmployeesView />);

    expect(screen.queryByText('employees.actions.create')).not.toBeInTheDocument();

    const row = screen.getByText('Alisher Karimov').closest('tr') as HTMLTableRowElement;
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });

  it('archiving an active employee asks for confirmation, then calls the toggle mutation', async () => {
    const user = userEvent.setup();
    mockEmployeesData([activeEmployee]);

    render(<EmployeesView />);

    const row = screen.getByText('Alisher Karimov').closest('tr') as HTMLTableRowElement;
    await user.click(within(row).getByRole('button'));

    await user.click(await screen.findByText('employees.actions.archive'));

    // ConfirmDialog opens; the mutation must not fire before confirmation.
    expect(await screen.findByText('employees.dialogs.archive.title')).toBeInTheDocument();
    expect(mockToggleMutation.mutate).not.toHaveBeenCalled();

    await user.click(screen.getByText('employees.dialogs.archive.confirm'));

    expect(mockToggleMutation.mutate).toHaveBeenCalledTimes(1);
    expect(mockToggleMutation.mutate).toHaveBeenCalledWith(
      { id: 1, isActive: false },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('activating an archived employee calls the toggle mutation without confirmation', async () => {
    const user = userEvent.setup();
    mockEmployeesData([archivedEmployee]);

    render(<EmployeesView />);

    const row = screen.getByText('Bobur Toshev').closest('tr') as HTMLTableRowElement;
    await user.click(within(row).getByRole('button'));

    await user.click(await screen.findByText('employees.actions.activate'));

    expect(screen.queryByText('employees.dialogs.archive.title')).not.toBeInTheDocument();
    expect(mockToggleMutation.mutate).toHaveBeenCalledWith(
      { id: 2, isActive: true },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('opens the upsert dialog in create mode from the create button', async () => {
    const user = userEvent.setup();

    render(<EmployeesView />);

    await user.click(screen.getByText('employees.actions.create'));

    expect(await screen.findByText('employees.form.createTitle')).toBeInTheDocument();
  });
});
