import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';

import { render, screen, within } from 'src/test-utils';

import type { Specialty } from '../api/types';
import SpecialtiesView from '../view';

// ----------------------------------------------------------------------

const mockEnqueueSnackbar = jest.fn();
const mockPermissions = jest.fn();
const mockUseSpecialtiesQuery = jest.fn();

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

jest.mock('../api/use-specialties-api', () => ({
  useSpecialtiesQuery: (...args: unknown[]) => mockUseSpecialtiesQuery(...args),
  useCreateSpecialtyMutation: () => mockCreateMutation,
  useUpdateSpecialtyMutation: () => mockUpdateMutation,
}));

// ----------------------------------------------------------------------

const therapist: Specialty = {
  id: 1,
  name: 'Therapist',
  isActive: true,
  createdAt: '2026-01-10T08:00:00Z',
};

const welder: Specialty = {
  id: 2,
  name: 'Welder',
  isActive: false,
  createdAt: '2026-02-11T08:00:00Z',
};

function mockSpecialtiesData(results: Specialty[]) {
  mockUseSpecialtiesQuery.mockReturnValue({
    data: { results, count: results.length },
    isPending: false,
    isFetching: false,
    addItem: jest.fn(),
    updateItem: jest.fn(),
  });
}

describe('SpecialtiesView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions.mockReturnValue({ canWritePage: jest.fn(() => true) });
    mockSpecialtiesData([]);
  });

  it('shows skeleton rows while the list is pending', () => {
    mockUseSpecialtiesQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
      addItem: jest.fn(),
      updateItem: jest.fn(),
    });

    const { container } = render(<SpecialtiesView />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('specialties.empty')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no results', () => {
    render(<SpecialtiesView />);

    expect(screen.getByText('specialties.empty')).toBeInTheDocument();
  });

  it('renders data rows with name and status keys', () => {
    mockSpecialtiesData([therapist, welder]);

    render(<SpecialtiesView />);

    expect(screen.getByText('Therapist')).toBeInTheDocument();
    expect(screen.getByText('common.status.active')).toBeInTheDocument();
    expect(screen.getByText('Welder')).toBeInTheDocument();
    expect(screen.getByText('common.status.inactive')).toBeInTheDocument();
    expect(screen.queryByText('specialties.empty')).not.toBeInTheDocument();
  });

  it('shows the create button and the edit column when specialties:write is granted', () => {
    mockSpecialtiesData([therapist]);

    render(<SpecialtiesView />);

    expect(screen.getByText('specialties.actions.create')).toBeInTheDocument();

    const row = screen.getByText('Therapist').closest('tr') as HTMLTableRowElement;
    expect(within(row).getByRole('button')).toBeInTheDocument();
  });

  it('hides the create button and the edit column without specialties:write', () => {
    mockPermissions.mockReturnValue({ canWritePage: jest.fn(() => false) });
    mockSpecialtiesData([therapist]);

    render(<SpecialtiesView />);

    expect(screen.queryByText('specialties.actions.create')).not.toBeInTheDocument();

    const row = screen.getByText('Therapist').closest('tr') as HTMLTableRowElement;
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens the upsert dialog in edit mode with the row values', async () => {
    const user = userEvent.setup();
    mockSpecialtiesData([therapist]);

    render(<SpecialtiesView />);

    const row = screen.getByText('Therapist').closest('tr') as HTMLTableRowElement;
    await user.click(within(row).getByRole('button'));

    expect(await screen.findByText('specialties.form.editTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('specialties.form.name *')).toHaveValue('Therapist');
  });

  it('opens the upsert dialog in create mode from the create button', async () => {
    const user = userEvent.setup();

    render(<SpecialtiesView />);

    await user.click(screen.getByText('specialties.actions.create'));

    expect(await screen.findByText('specialties.form.createTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('specialties.form.name *')).toHaveValue('');
  });
});
