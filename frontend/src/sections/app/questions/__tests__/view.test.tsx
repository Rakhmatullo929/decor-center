import { render, screen } from 'src/test-utils';

import type { Question } from '../api/types';
import QuestionsView from '../view';

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

// error-reader imports axios (ESM) which jest cannot parse with the CRA transform config.
jest.mock('src/utils/error-reader', () => ({
  errorReader: (error: unknown) => String(error),
}));

jest.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
}));

const mockPermissions = jest.fn();
jest.mock('src/auth/hooks', () => ({
  useCheckPermission: () => mockPermissions(),
}));

jest.mock('src/components/scrollbar', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockUseQuestionsQuery = jest.fn();
jest.mock('../api/use-questions-api', () => ({
  useQuestionsQuery: (...args: unknown[]) => mockUseQuestionsQuery(...args),
  useApproveQuestionMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteQuestionMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useCreateQuestionMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateQuestionMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('../../specialties/api/use-specialties-api', () => ({
  useSpecialtyOptionsQuery: () => ({ data: { results: [] }, isPending: false }),
}));

const questions: Question[] = [
  {
    id: 1,
    module: 'tech_safety',
    specialty: null,
    specialtyName: null,
    text: 'First question text',
    options: ['A', 'B', 'C', 'D'],
    correctOption: 0,
    source: 'manual',
    status: 'draft',
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 2,
    module: 'specialty',
    specialty: 3,
    specialtyName: 'Mechanic',
    text: 'Second question text',
    options: ['A', 'B', 'C', 'D'],
    correctOption: 1,
    source: 'ai',
    status: 'approved',
    createdAt: '2026-01-16T10:00:00Z',
  },
];

function queryResult(results: Question[], count: number, isPending = false) {
  return {
    data: isPending ? undefined : { results, count },
    isPending,
    isFetching: isPending,
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
  };
}

function allowWrite(canWrite: boolean) {
  mockPermissions.mockReturnValue({
    canReadPage: jest.fn(() => true),
    canWritePage: jest.fn(() => canWrite),
    canDetailPage: jest.fn(() => true),
  });
}

describe('QuestionsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowWrite(true);
    mockUseQuestionsQuery.mockReturnValue(queryResult(questions, questions.length));
  });

  it('shows skeleton rows while the list is pending', () => {
    mockUseQuestionsQuery.mockReturnValue(queryResult([], 0, true));

    const { container } = render(<QuestionsView />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('questions.empty')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no questions', () => {
    mockUseQuestionsQuery.mockReturnValue(queryResult([], 0));

    render(<QuestionsView />);

    expect(screen.getByText('questions.empty')).toBeInTheDocument();
  });

  it('renders question rows with status keys', () => {
    render(<QuestionsView />);

    expect(screen.getByText('First question text')).toBeInTheDocument();
    expect(screen.getByText('Second question text')).toBeInTheDocument();
    expect(screen.getByText('common.status.draft')).toBeInTheDocument();
    expect(screen.getByText('common.status.approved')).toBeInTheDocument();
    expect(screen.queryByText('questions.empty')).not.toBeInTheDocument();
  });

  it('shows the create button when canWritePage is true', () => {
    render(<QuestionsView />);

    expect(screen.getByRole('button', { name: 'questions.actions.create' })).toBeInTheDocument();
  });

  it('hides the create button when canWritePage is false', () => {
    allowWrite(false);

    render(<QuestionsView />);

    expect(
      screen.queryByRole('button', { name: 'questions.actions.create' })
    ).not.toBeInTheDocument();
  });
});
