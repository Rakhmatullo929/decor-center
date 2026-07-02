import { act, fireEvent, render, screen, waitFor } from 'src/test-utils';

import type { TestQuestion, TestSession } from '../api/types';
import QuestionsView from '../questions-view';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (key: string) => key, currentLang: { value: 'uz' } }),
}));

jest.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
}));

jest.mock('src/utils/error-reader', () => ({ errorReader: (e: unknown) => String(e) }));

// react-router: test-utils already provides a MemoryRouter, so we only override the hooks
// to feed location.state (the session/questions handed off from the start screen).
let mockLocationState: { session: TestSession; questions: TestQuestion[] } | undefined;
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockLocationState }),
}));

// The components barrel re-exports FaceIdStep, which imports src/auth/api -> axios (ESM,
// untransformed by CRA jest). Stub it so importing the barrel doesn't pull axios.
jest.mock('../components/face-id-step', () => ({ __esModule: true, default: () => null }));

// TestingPanel renders ThreeBg (WebGL) — stub to a passthrough so jsdom doesn't choke.
jest.mock('../components/testing-panel', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// SubmitFaceStep owns the camera — stub it to a button that yields a base64 frame.
jest.mock('../components/submit-face-step', () => ({
  __esModule: true,
  default: ({ onCapture }: { onCapture: (b: string) => void }) => (
    <button type="button" onClick={() => onCapture('data:image/jpeg;base64,AAAA')}>
      stub-confirm
    </button>
  ),
}));

const mockSubmitMutate = jest.fn();
jest.mock('../api/use-testing-api', () => ({
  useSubmitTestSessionMutation: () => ({ mutate: mockSubmitMutate, isPending: false }),
}));

const questions: TestQuestion[] = [
  { id: 1, module: 'tech_safety', text: 'Question one?', options: ['Option one', 'Option two'] },
];

function makeSession(requiresSubmitReverify: boolean): TestSession {
  return {
    id: 11,
    employee: 2,
    employeeName: 'Jane Smith',
    module: 'tech_safety',
    specialty: null,
    specialtyName: null,
    startedAt: '2026-06-10T08:00:00Z',
    finishedAt: null,
    score: null,
    total: 1,
    passed: null,
    faceVerified: true,
    submitFaceVerified: null,
    requiresSubmitReverify,
  };
}

function renderView(session: TestSession) {
  mockLocationState = { session, questions };
  return render(<QuestionsView />);
}

describe('QuestionsView submit re-verification', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits directly without a capture step when reverify is off', async () => {
    renderView(makeSession(false));
    await act(async () => {});

    fireEvent.click(screen.getByText('Option one'));
    fireEvent.click(screen.getByText('common.actions.submit'));

    await waitFor(() => expect(mockSubmitMutate).toHaveBeenCalledTimes(1));
    expect(mockSubmitMutate.mock.calls[0][0].payload.faceImage).toBeUndefined();
    expect(screen.queryByText('stub-confirm')).not.toBeInTheDocument();
  });

  it('shows the capture step then submits with faceImage when reverify is on', async () => {
    renderView(makeSession(true));
    await act(async () => {});

    fireEvent.click(screen.getByText('Option one'));
    fireEvent.click(screen.getByText('common.actions.submit'));

    // Capture step (stub) is shown; no submit yet.
    const confirm = await screen.findByText('stub-confirm');
    expect(mockSubmitMutate).not.toHaveBeenCalled();

    fireEvent.click(confirm);
    await waitFor(() => expect(mockSubmitMutate).toHaveBeenCalledTimes(1));
    expect(mockSubmitMutate.mock.calls[0][0].payload.faceImage).toEqual('data:image/jpeg;base64,AAAA');
  });
});
