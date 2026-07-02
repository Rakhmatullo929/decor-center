import { render, screen } from 'src/test-utils';

import type { Instruction } from '../api/types';
import InstructionsView from '../view';

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

// error-reader imports axios (ESM) which jest cannot parse with the CRA transform config.
jest.mock('src/utils/error-reader', () => ({
  errorReader: (error: unknown) => String(error),
}));

const mockPermissions = jest.fn();
jest.mock('src/auth/hooks', () => ({
  useCheckPermission: () => mockPermissions(),
}));

jest.mock('src/components/scrollbar', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockUseInstructionsQuery = jest.fn();
jest.mock('../api/use-instructions-api', () => ({
  useInstructionsQuery: (...args: unknown[]) => mockUseInstructionsQuery(...args),
  useCreateInstructionMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteInstructionMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useGenerateQuestionsMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('../../specialties/api/use-specialties-api', () => ({
  useSpecialtyOptionsQuery: () => ({ data: { results: [] }, isPending: false }),
}));

const instructions: Instruction[] = [
  {
    id: 1,
    specialty: 3,
    specialtyName: 'Mechanic',
    title: 'Brake maintenance manual',
    file: 'https://files.local/brake.pdf',
    generationStatus: 'completed',
    lastGeneratedAt: '2026-02-01T10:00:00Z',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 2,
    specialty: 4,
    specialtyName: 'Electrician',
    title: 'Wiring safety guide',
    file: 'https://files.local/wiring.pdf',
    generationStatus: 'not_started',
    lastGeneratedAt: null,
    createdAt: '2026-01-12T10:00:00Z',
  },
];

function queryResult(results: Instruction[], count: number, isPending = false) {
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

describe('InstructionsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowWrite(true);
    mockUseInstructionsQuery.mockReturnValue(queryResult(instructions, instructions.length));
  });

  it('shows skeleton rows while the list is pending', () => {
    mockUseInstructionsQuery.mockReturnValue(queryResult([], 0, true));

    const { container } = render(<InstructionsView />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('instructions.empty')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no instructions', () => {
    mockUseInstructionsQuery.mockReturnValue(queryResult([], 0));

    render(<InstructionsView />);

    expect(screen.getByText('instructions.empty')).toBeInTheDocument();
  });

  it('renders instruction rows with generation status keys', () => {
    render(<InstructionsView />);

    expect(screen.getByText('Brake maintenance manual')).toBeInTheDocument();
    expect(screen.getByText('Wiring safety guide')).toBeInTheDocument();
    expect(screen.getByText('Mechanic')).toBeInTheDocument();
    expect(screen.getByText('instructions.status.completed')).toBeInTheDocument();
    expect(screen.getByText('instructions.status.notStarted')).toBeInTheDocument();
    expect(screen.queryByText('instructions.empty')).not.toBeInTheDocument();
  });

  it('shows the upload button when canWritePage is true', () => {
    render(<InstructionsView />);

    expect(
      screen.getByRole('button', { name: 'instructions.actions.upload' })
    ).toBeInTheDocument();
  });

  it('hides the upload button when canWritePage is false', () => {
    allowWrite(false);

    render(<InstructionsView />);

    expect(
      screen.queryByRole('button', { name: 'instructions.actions.upload' })
    ).not.toBeInTheDocument();
  });
});
