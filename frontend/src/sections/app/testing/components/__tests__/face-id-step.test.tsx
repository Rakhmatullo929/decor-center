import { act, fireEvent, render, screen, waitFor } from 'src/test-utils';

import type { Employee } from '../../../employees/api/types';
import FaceIdStep from '../face-id-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

jest.mock('src/utils/error-reader', () => ({
  errorReader: (error: unknown) => String(error),
}));

const mockIdentifyMutate = jest.fn();
const mockStartMutate    = jest.fn();

jest.mock('../../api/use-testing-api', () => ({
  useIdentifyEmployeeMutation: () => ({ mutate: mockIdentifyMutate, isPending: false }),
  useStartTestSessionMutation: () => ({ mutate: mockStartMutate,    isPending: false }),
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

const mockGetUserMedia = jest.fn();
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob    = HTMLCanvasElement.prototype.toBlob;

beforeAll(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: mockGetUserMedia },
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth',  { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 480 });
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage: jest.fn() })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
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

function makeStream(trackStop: jest.Mock) {
  return { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
}

function renderStep(props?: { onStarted?: jest.Mock; onBack?: jest.Mock }) {
  const onStarted = props?.onStarted ?? jest.fn();
  const onBack    = props?.onBack    ?? jest.fn();
  return { onStarted, onBack, ...render(<FaceIdStep onStarted={onStarted} onBack={onBack} />) };
}

describe('FaceIdStep', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows camera-denied error when access is rejected', async () => {
    mockGetUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    renderStep();
    expect(await screen.findByText('testing.faceId.cameraDenied')).toBeInTheDocument();
    expect(screen.queryByText('testing.faceId.scan')).not.toBeInTheDocument();
  });

  it('shows camera-unavailable error for non-permission failures', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('no camera'));
    renderStep();
    expect(await screen.findByText('testing.faceId.cameraUnavailable')).toBeInTheDocument();
  });

  it('shows the scan button and instruction when the camera starts', async () => {
    mockGetUserMedia.mockResolvedValue(makeStream(jest.fn()));
    renderStep();
    await act(async () => {});
    expect(screen.getByText('testing.faceId.scan')).toBeInTheDocument();
    expect(screen.getByText('testing.faceId.instruction')).toBeInTheDocument();
    expect(screen.queryByText('testing.faceId.startTest')).not.toBeInTheDocument();
  });

  it('stops every camera track on unmount', async () => {
    const trackStop = jest.fn();
    mockGetUserMedia.mockResolvedValue(makeStream(trackStop));
    const { unmount } = renderStep();
    await waitFor(() => expect(mockGetUserMedia).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(trackStop).not.toHaveBeenCalled();
    unmount();
    expect(trackStop).toHaveBeenCalledTimes(1);
  });

  it('calls identify mutation with a File when scan is clicked', async () => {
    mockGetUserMedia.mockResolvedValue(makeStream(jest.fn()));
    renderStep();
    await act(async () => {});

    fireEvent.click(screen.getByText('testing.faceId.scan'));
    await waitFor(() => expect(mockIdentifyMutate).toHaveBeenCalledTimes(1));
    expect(mockIdentifyMutate.mock.calls[0][0].faceImage).toBeInstanceOf(File);
  });

  it('shows identified employee and start-test button after successful identify', async () => {
    mockGetUserMedia.mockResolvedValue(makeStream(jest.fn()));
    mockIdentifyMutate.mockImplementation((_payload: unknown, options: { onSuccess: (d: unknown) => void }) =>
      options.onSuccess({ employee })
    );

    renderStep();
    await act(async () => {});
    fireEvent.click(screen.getByText('testing.faceId.scan'));
    await act(async () => {});

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Assistant machinist')).toBeInTheDocument();
    expect(screen.getByText('testing.faceId.startTest')).toBeInTheDocument();
    expect(screen.queryByText('testing.faceId.scan')).not.toBeInTheDocument();
  });

  it('resets to scanning phase when "not you" is clicked', async () => {
    mockGetUserMedia.mockResolvedValue(makeStream(jest.fn()));
    mockIdentifyMutate.mockImplementation((_payload: unknown, options: { onSuccess: (d: unknown) => void }) =>
      options.onSuccess({ employee })
    );

    renderStep();
    await act(async () => {});
    fireEvent.click(screen.getByText('testing.faceId.scan'));
    await act(async () => {});
    expect(screen.getByText('testing.faceId.startTest')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('testing.faceId.notYou')[0]);
    expect(screen.getByText('testing.faceId.scan')).toBeInTheDocument();
    expect(screen.queryByText('testing.faceId.startTest')).not.toBeInTheDocument();
  });

  it('calls start mutation with correct employee/module and fires onStarted', async () => {
    mockGetUserMedia.mockResolvedValue(makeStream(jest.fn()));
    mockIdentifyMutate.mockImplementation((_payload: unknown, options: { onSuccess: (d: unknown) => void }) =>
      options.onSuccess({ employee })
    );
    const startResponse = {
      session: { id: 11, employee: 2, module: 'specialty' },
      questions: [],
    };
    const onStarted = jest.fn();
    mockStartMutate.mockImplementation((_payload: unknown, options: { onSuccess: (d: unknown) => void }) =>
      options.onSuccess(startResponse)
    );

    renderStep({ onStarted });
    await act(async () => {});
    fireEvent.click(screen.getByText('testing.faceId.scan'));
    await act(async () => {});
    fireEvent.click(screen.getByText('testing.faceId.startTest'));
    await waitFor(() => expect(mockStartMutate).toHaveBeenCalledTimes(1));

    expect(mockStartMutate.mock.calls[0][0]).toMatchObject({ employee: 2, module: 'specialty' });
    expect(mockStartMutate.mock.calls[0][0].faceImage).toBeInstanceOf(File);
    expect(onStarted).toHaveBeenCalledWith(startResponse);
  });

  it('fires onBack from the back button', async () => {
    mockGetUserMedia.mockResolvedValue(makeStream(jest.fn()));
    const { onBack } = renderStep();
    await act(async () => {});
    fireEvent.click(screen.getByText('common.actions.back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
