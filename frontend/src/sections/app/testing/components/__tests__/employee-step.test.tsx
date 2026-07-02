import { fireEvent, render, screen } from 'src/test-utils';

import type { Employee } from '../../../employees/api/types';
import EmployeeStep from '../employee-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

const mockUseTestingEmployeesQuery = jest.fn();
jest.mock('../../api/use-testing-api', () => ({
  useTestingEmployeesQuery: (...args: unknown[]) => mockUseTestingEmployeesQuery(...args),
}));

const employees: Employee[] = [
  {
    id: 1,
    fullName: 'John Doe',
    specialty: 4,
    specialtyName: 'Machinist',
    photo: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    fullName: 'Jane Smith',
    specialty: 5,
    specialtyName: 'Assistant machinist',
    photo: 'https://example.com/jane.jpg',
    isActive: true,
    createdAt: '2026-01-02T00:00:00Z',
  },
];

function mockQuery(results: Employee[], overrides?: Record<string, unknown>) {
  mockUseTestingEmployeesQuery.mockReturnValue({
    data: { results, count: results.length },
    isPending: false,
    isFetching: false,
    ...overrides,
  });
}

describe('EmployeeStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery(employees);
  });

  it('renders the skeleton grid while the list is pending', () => {
    mockUseTestingEmployeesQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
    });

    const { container } = render(<EmployeeStep onSelect={jest.fn()} />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('testing.employee.empty')).not.toBeInTheDocument();
  });

  it('renders the empty state when no employees match', () => {
    mockQuery([]);

    render(<EmployeeStep onSelect={jest.fn()} />);

    expect(screen.getByText('testing.employee.empty')).toBeInTheDocument();
  });

  it('renders employee cards from the search hook', () => {
    render(<EmployeeStep onSelect={jest.fn()} />);

    expect(screen.getByText('testing.steps.employee')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Machinist')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Assistant machinist')).toBeInTheDocument();
  });

  it('fires onSelect with the clicked employee', () => {
    const onSelect = jest.fn();
    render(<EmployeeStep onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Jane Smith'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(employees[1]);
  });

  it('queries only active employees', () => {
    render(<EmployeeStep onSelect={jest.fn()} />);

    expect(mockUseTestingEmployeesQuery).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true })
    );
  });
});
