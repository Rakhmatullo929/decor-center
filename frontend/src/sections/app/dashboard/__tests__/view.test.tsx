import { render, screen } from 'src/test-utils';

import type { DashboardStats } from '../api/types';
import DashboardView from '../view';

// ----------------------------------------------------------------------

const mockUseDashboardStatsQuery = jest.fn();

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

jest.mock('../api/use-dashboard-api', () => ({
  useDashboardStatsQuery: (...args: unknown[]) => mockUseDashboardStatsQuery(...args),
}));

// ----------------------------------------------------------------------

const stats: DashboardStats = {
  date: '2026-06-10',
  tests: {
    total: 12,
    passed: 8,
    failed: 3,
    inProgress: 1,
    byModule: [
      { module: 'specialty', total: 6, passed: 5 },
      { module: 'tech_safety', total: 6, passed: 3 },
    ],
  },
  medical: {
    total: 7,
    approved: 5,
    rejected: 2,
  },
  totals: {
    activeEmployees: 31,
    approvedQuestions: 120,
    draftQuestions: 4,
    instructions: 9,
  },
};

describe('DashboardView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardStatsQuery.mockReturnValue({
      data: stats,
      isPending: false,
      isFetching: false,
    });
  });

  it('shows the skeleton while stats are pending', () => {
    mockUseDashboardStatsQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isFetching: true,
    });

    const { container } = render(<DashboardView />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('dashboard.tests.title')).not.toBeInTheDocument();
    expect(screen.queryByText('common.table.noData')).not.toBeInTheDocument();
  });

  it('shows the empty state when stats are missing', () => {
    mockUseDashboardStatsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isFetching: false,
    });

    render(<DashboardView />);

    expect(screen.getByText('common.table.noData')).toBeInTheDocument();
    expect(screen.queryByText('dashboard.tests.title')).not.toBeInTheDocument();
  });

  it('renders stat cards with numbers from the stats query', () => {
    render(<DashboardView />);

    // tests
    expect(screen.getByText('dashboard.tests.total')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    // medical
    expect(screen.getByText('dashboard.medical.title')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // totals
    expect(screen.getByText('dashboard.totals.title')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('renders byModule rows with module label keys', () => {
    render(<DashboardView />);

    expect(screen.getByText('dashboard.byModule.title')).toBeInTheDocument();
    expect(screen.getByText('common.modules.specialty')).toBeInTheDocument();
    expect(screen.getByText('common.modules.techSafety')).toBeInTheDocument();
    expect(screen.queryByText('common.modules.industrialSafety')).not.toBeInTheDocument();
    expect(screen.getAllByText('dashboard.byModule.passedOf')).toHaveLength(2);
    expect(screen.queryByText('dashboard.byModule.empty')).not.toBeInTheDocument();
  });

  it('shows the byModule empty hint when there are no module rows', () => {
    mockUseDashboardStatsQuery.mockReturnValue({
      data: { ...stats, tests: { ...stats.tests, byModule: [] } },
      isPending: false,
      isFetching: false,
    });

    render(<DashboardView />);

    expect(screen.getByText('dashboard.byModule.empty')).toBeInTheDocument();
  });

  it('fills the date picker from the stats date when the URL has no date', () => {
    render(<DashboardView />);

    expect(screen.getByLabelText('dashboard.dateLabel')).toHaveValue('2026-06-10');
  });

  it('passes the URL date to the stats query', () => {
    render(<DashboardView />, { routerEntries: ['/?date=2026-06-01'] });

    expect(mockUseDashboardStatsQuery).toHaveBeenCalledWith({ date: '2026-06-01' });
    expect(screen.getByLabelText('dashboard.dateLabel')).toHaveValue('2026-06-01');
  });
});
