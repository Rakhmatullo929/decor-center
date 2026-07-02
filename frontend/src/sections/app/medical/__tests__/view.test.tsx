import React from 'react';

import { fireEvent, render, screen } from 'src/test-utils';

import type { MedicalCheck } from '../api/types';
import MedicalView from '../view';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

jest.mock('src/components/settings', () => ({
  useSettingsContext: () => ({ themeStretch: false }),
}));

jest.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
}));

jest.mock('src/components/scrollbar', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// error-reader imports axios (ESM-only), which CRA's jest transform does not handle.
jest.mock('src/utils/error-reader', () => ({
  errorReader: (error: unknown) => String(error),
}));

const mockCanWritePage = jest.fn();
jest.mock('src/auth/hooks', () => ({
  useCheckPermission: () => ({ canWritePage: (page: string) => mockCanWritePage(page) }),
}));

const mockUseMedicalChecksQuery = jest.fn();
const mockExportMutate = jest.fn();
jest.mock('../api/use-medical-api', () => ({
  useMedicalChecksQuery: (...args: unknown[]) => mockUseMedicalChecksQuery(...args),
  useExportMedicalChecksMutation: () => ({ mutate: mockExportMutate, isPending: false }),
  useCreateMedicalCheckMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateMedicalCheckMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// The upsert dialog (mounted by the view) loads the employee autocomplete options.
jest.mock('../../employees/api/use-employees-api', () => ({
  useEmployeesQuery: () => ({
    data: { results: [], count: 0 },
    isPending: false,
    isFetching: false,
  }),
}));

const checks: MedicalCheck[] = [
  {
    id: 1,
    employee: 7,
    employeeName: 'John Doe',
    bpSystolic: 120,
    bpDiastolic: 80,
    pulse: 70,
    saturation: 98,
    alcoholValue: null,
    alcoholPositive: false,
    hoursWorked: '8.0',
    hoursRested: '12.0',
    conclusion: 'approved',
    note: '',
    medic: 3,
    medicUsername: 'medic1',
    createdAt: '2026-06-10T08:00:00Z',
  },
  {
    id: 2,
    employee: 8,
    employeeName: 'Jane Roe',
    bpSystolic: 150,
    bpDiastolic: 95,
    pulse: 115,
    saturation: 90,
    alcoholValue: '0.300',
    alcoholPositive: true,
    hoursWorked: '10.0',
    hoursRested: '6.0',
    conclusion: 'rejected',
    note: 'high BP',
    medic: 3,
    medicUsername: 'medic1',
    createdAt: '2026-06-09T08:00:00Z',
  },
];

function mockQueryData(results: MedicalCheck[], overrides?: Record<string, unknown>) {
  mockUseMedicalChecksQuery.mockReturnValue({
    data: { results, count: results.length },
    isPending: false,
    isFetching: false,
    addItem: jest.fn(),
    updateItem: jest.fn(),
    ...overrides,
  });
}

describe('MedicalView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanWritePage.mockReturnValue(true);
    mockQueryData(checks);
  });

  it('renders skeleton rows while the list is pending', () => {
    mockUseMedicalChecksQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
      addItem: jest.fn(),
      updateItem: jest.fn(),
    });

    const { container } = render(<MedicalView />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('medical.empty')).not.toBeInTheDocument();
  });

  it('renders the empty state when there are no records', () => {
    mockQueryData([]);

    render(<MedicalView />);

    expect(screen.getByText('medical.empty')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<MedicalView />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Roe')).toBeInTheDocument();
    expect(screen.getByText('120/80')).toBeInTheDocument();
    expect(screen.getByText('medical.conclusion.rejected')).toBeInTheDocument();
    expect(screen.queryByText('medical.empty')).not.toBeInTheDocument();
  });

  it('shows the create button with medical:write', () => {
    render(<MedicalView />);

    expect(screen.getByText('medical.actions.create')).toBeInTheDocument();
  });

  it('hides the create button without medical:write', () => {
    mockCanWritePage.mockImplementation((page: string) => page !== 'medical');

    render(<MedicalView />);

    expect(screen.queryByText('medical.actions.create')).not.toBeInTheDocument();
  });

  it('shows the actions column with medical_edit:write', () => {
    render(<MedicalView />);

    // 10 data columns + 1 actions column
    expect(screen.getAllByRole('columnheader')).toHaveLength(11);
  });

  it('hides the actions column without medical_edit:write', () => {
    mockCanWritePage.mockImplementation((page: string) => page !== 'medical_edit');

    render(<MedicalView />);

    expect(screen.getAllByRole('columnheader')).toHaveLength(10);
  });

  it('fires the export mutation without pagination params', () => {
    render(<MedicalView />);

    fireEvent.click(screen.getByText('common.actions.export'));

    expect(mockExportMutate).toHaveBeenCalledTimes(1);
    expect(mockExportMutate.mock.calls[0][0]).toEqual({ ordering: '-created_at' });
  });
});
