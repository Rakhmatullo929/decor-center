import { act, fireEvent, render, screen, waitFor } from 'src/test-utils';
import { MemoryRouter } from 'react-router-dom';

import type { Employee } from '../../employees/api/types';
import type { StartTestSessionResponse, TestSession } from '../api/types';
import FaceRecognitionView from '../face-recognition-view';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('src/utils/error-reader', () => ({
  errorReader: (error: unknown) => String(error),
}));

const mockIdentifyMutate = jest.fn();
const mockStartMutate    = jest.fn();
const mockSubmitMutate   = jest.fn();

jest.mock('../api/use-testing-api', () => ({
  useIdentifyEmployeeMutation: () => ({ mutate: mockIdentifyMutate, isPending: false }),
  useStartTestSessionMutation: () => ({ mutate: mockStartMutate,    isPending: false }),
  useSubmitTestSessionMutation: () => ({ mutate: mockSubmitMutate,  isPending: false }),
  useTestingEmployeesQuery: jest.fn(),
}));

const employee: Employee = {
  id: 2,
  fullName: 'Jane Smith',
  specialty: 5,
  specialtyName: 'Assistant machinist',
  photo: null,
  isActive: true,
  createdAt: '2026-01-02T00:00:00Z',
};

const session: TestSession = {
  id: 11,
  employee: 2,
  employeeName: 'Jane Smith',
  module: 'tech_safety',
  specialty: null,
  specialtyName: null,
  startedAt: '2026-06-10T08:00:00Z',
  finishedAt: null,
  score: null,
  total: 2,
  passed: null,
  faceVerified: true,
  submitFaceVerified: null,
  requiresSubmitReverify: false,
};

const startResponse: StartTestSessionResponse = {
  session,
  questions: [
    { id: 1, module: 'tech_safety', text: 'Question one?', options: ['A1', 'B1'] },
  ],
};

const mockGetUserMedia = jest.fn();
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob    = HTMLCanvasElement.prototype.toBlob;

beforeAll(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: mockGetUserMedia },
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get: () => 640,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get: () => 480,
  });
  // Plain function (not jest.fn): CRA Jest's resetMocks wipes mock
  // implementations between tests, which would make getContext return undefined
  // and abort handleCapture before the start mutation fires.
  HTMLCanvasElement.prototype.getContext = function getContextMock() {
    return { drawImage: () => {} };
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function toBlobMock(callback: BlobCallback) {
    callback(new Blob(['frame'], { type: 'image/jpeg' }));
  };
});

afterAll(() => {
  delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
  delete (HTMLVideoElement.prototype as unknown as { videoWidth?: unknown }).videoWidth;
  delete (HTMLVideoElement.prototype as unknown as { videoHeight?: unknown }).videoHeight;
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob    = originalToBlob;
});

function renderView() {
  return render(
    <MemoryRouter>
      <FaceRecognitionView />
    </MemoryRouter>
  );
}

describe('FaceRecognitionView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
    } as unknown as MediaStream);
  });

  it('renders the scan button and ready status', async () => {
    renderView();
    await act(async () => {});
    expect(screen.getByText('testing.faceId.scan')).toBeInTheDocument();
    expect(screen.getByText('testing.steps.faceId')).toBeInTheDocument();
  });

  it('calls identify mutation when scan is clicked', async () => {
    renderView();
    await act(async () => {});

    fireEvent.click(screen.getByText('testing.faceId.scan'));

    await waitFor(() => expect(mockIdentifyMutate).toHaveBeenCalledTimes(1));
    expect(mockIdentifyMutate.mock.calls[0][0].faceImage).toBeInstanceOf(File);
  });

  it('shows identified employee and start button after successful identify', async () => {
    mockIdentifyMutate.mockImplementation((_payload, options) =>
      options.onSuccess({ employee })
    );

    renderView();
    await act(async () => {});

    fireEvent.click(screen.getByText('testing.faceId.scan'));
    await act(async () => {});

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Assistant machinist')).toBeInTheDocument();
    expect(screen.getByText('testing.faceId.startTest')).toBeInTheDocument();
  });

  it('calls start mutation with identified employee and navigates to questions', async () => {
    mockIdentifyMutate.mockImplementation((_payload, options) =>
      options.onSuccess({ employee })
    );
    mockStartMutate.mockImplementation((_payload, options) =>
      options.onSuccess(startResponse)
    );

    renderView();
    await act(async () => {});

    fireEvent.click(screen.getByText('testing.faceId.scan'));
    await act(async () => {});

    fireEvent.click(screen.getByText('testing.faceId.startTest'));
    await waitFor(() => expect(mockStartMutate).toHaveBeenCalledTimes(1));

    expect(mockStartMutate.mock.calls[0][0]).toMatchObject({
      employee: 2,
      module: 'specialty',
    });
    expect(mockStartMutate.mock.calls[0][0].faceImage).toBeInstanceOf(File);

    expect(mockNavigate).toHaveBeenCalledWith(
      `/testing/tests/2/tech_safety`,
      { state: { session, questions: startResponse.questions } }
    );
  });

  it('resets to scanning phase when "not you" is clicked', async () => {
    mockIdentifyMutate.mockImplementation((_payload, options) =>
      options.onSuccess({ employee })
    );

    renderView();
    await act(async () => {});

    fireEvent.click(screen.getByText('testing.faceId.scan'));
    await act(async () => {});

    expect(screen.getByText('testing.faceId.startTest')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('testing.faceId.notYou')[0]);

    expect(screen.getByText('testing.faceId.scan')).toBeInTheDocument();
    expect(screen.queryByText('testing.faceId.startTest')).not.toBeInTheDocument();
  });
});
