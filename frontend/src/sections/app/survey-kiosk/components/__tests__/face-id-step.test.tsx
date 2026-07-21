import { act, fireEvent, render, screen } from 'src/test-utils';

import { captureFrame } from 'src/utils/camera';

import FaceIdStep from '../face-id-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

// Bare mocks — the resolved Blob is created at runtime inside the test. A `new Blob()`
// evaluated in the mock-factory scope resolves to `undefined` in this jsdom/jest setup
// (the jsdom Blob global isn't installed yet at that point).
jest.mock('src/utils/camera', () => ({
  captureFrame: jest.fn(),
  blobToBase64: jest.fn(),
}));

// error-reader.ts pulls in axios (ESM, untransformed by jest) — mock it like the other
// tests that exercise components importing it (employee-upsert-dialog.test.tsx, view.test.tsx).
jest.mock('src/utils/error-reader', () => ({
  errorReader: () => 'mock-error',
}));

const mockIdentified = { id: 3, fullName: 'Ivan', specialtyName: 'Fitter', photo: null };
const mockIdentifyMutate = jest.fn();
jest.mock('../../api/use-survey-kiosk-api', () => ({
  useIdentifyEmployeeMutation: () => ({ mutate: mockIdentifyMutate, isPending: false }),
}));

beforeAll(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [] }) },
  });
});

describe('kiosk FaceIdStep', () => {
  it('identifies then hands the employee + blob to onIdentified', async () => {
    // CRA's jest config sets resetMocks:true, which wipes mock implementations before each
    // test — so both the captureFrame resolution and the mutate impl must be set here, not
    // at module/factory level (where they'd be reset away, leaving no-op mocks).
    (captureFrame as jest.Mock).mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    mockIdentifyMutate.mockImplementation((_vars, opts) => opts.onSuccess({ employee: mockIdentified }));

    const onIdentified = jest.fn();
    render(<FaceIdStep onIdentified={onIdentified} onBack={jest.fn()} />);

    // handleScan is async (captureFrame await -> mutate -> onSuccess setState). Drive the
    // click inside async act() so that whole microtask chain flushes and commits before we
    // assert — otherwise the identified-phase re-render never lands for RTL.
    await act(async () => {
      fireEvent.click(screen.getByText('survey.kiosk.faceId.scan'));
    });
    expect(mockIdentifyMutate).toHaveBeenCalled();

    fireEvent.click(screen.getByText('survey.kiosk.faceId.continue'));
    expect(onIdentified).toHaveBeenCalledWith(mockIdentified, expect.any(Blob));
  });
});
