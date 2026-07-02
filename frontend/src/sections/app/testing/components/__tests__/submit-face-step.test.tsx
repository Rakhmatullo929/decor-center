import { act, fireEvent, render, screen, waitFor } from 'src/test-utils';

import SubmitFaceStep from '../submit-face-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (key: string) => key, currentLang: { value: 'uz' } }),
}));

// Plain functions (not jest.fn): CRA Jest's resetMocks wipes mock implementations
// between tests, which would make captureFrame return undefined and abort handleConfirm.
jest.mock('src/utils/camera', () => ({
  captureFrame: async () => new Blob(['x'], { type: 'image/jpeg' }),
  blobToBase64: async () => 'data:image/jpeg;base64,AAAA',
}));

const mockGetUserMedia = jest.fn();

beforeAll(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: mockGetUserMedia },
  });
});
afterAll(() => {
  delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
});

function makeStream(stop: jest.Mock) {
  return { getTracks: () => [{ stop }] } as unknown as MediaStream;
}

describe('SubmitFaceStep', () => {
  beforeEach(() => jest.clearAllMocks());

  it('captures a frame and calls onCapture with base64 on confirm', async () => {
    mockGetUserMedia.mockResolvedValue(makeStream(jest.fn()));
    const onCapture = jest.fn();
    render(<SubmitFaceStep onCapture={onCapture} onCancel={jest.fn()} isSubmitting={false} />);
    await act(async () => {});

    fireEvent.click(screen.getByText('testing.submitFace.confirm'));
    await waitFor(() => expect(onCapture).toHaveBeenCalledWith('data:image/jpeg;base64,AAAA'));
  });

  it('shows camera-denied error', async () => {
    mockGetUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    render(<SubmitFaceStep onCapture={jest.fn()} onCancel={jest.fn()} isSubmitting={false} />);
    expect(await screen.findByText('testing.faceId.cameraDenied')).toBeInTheDocument();
  });

  it('fires onCancel from the back button', async () => {
    mockGetUserMedia.mockResolvedValue(makeStream(jest.fn()));
    const onCancel = jest.fn();
    render(<SubmitFaceStep onCapture={jest.fn()} onCancel={onCancel} isSubmitting={false} />);
    await act(async () => {});
    fireEvent.click(screen.getByText('common.actions.back'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders the re-verify error message when provided', async () => {
    mockGetUserMedia.mockResolvedValue(makeStream(jest.fn()));
    render(
      <SubmitFaceStep
        onCapture={jest.fn()}
        onCancel={jest.fn()}
        isSubmitting={false}
        errorMessage="testing.submitFace.failed"
      />
    );
    expect(await screen.findByText('testing.submitFace.failed')).toBeInTheDocument();
  });
});
