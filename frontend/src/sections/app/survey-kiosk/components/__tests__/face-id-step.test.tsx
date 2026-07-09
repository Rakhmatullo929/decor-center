import { fireEvent, render, screen, waitFor } from 'src/test-utils';

import FaceIdStep from '../face-id-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

jest.mock('src/utils/camera', () => ({
  captureFrame: jest.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
  blobToBase64: jest.fn().mockResolvedValue('data:image/jpeg;base64,x'),
}));

// error-reader.ts pulls in axios (ESM, untransformed by jest) — mock it like the other
// tests that exercise components importing it (employee-upsert-dialog.test.tsx, view.test.tsx).
jest.mock('src/utils/error-reader', () => ({
  errorReader: () => 'mock-error',
}));

const mockIdentified = { id: 3, fullName: 'Ivan', specialtyName: 'Fitter', photo: null };
const mockIdentifyMutate = jest.fn((_vars, opts) => opts.onSuccess({ employee: mockIdentified }));
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
    const onIdentified = jest.fn();
    render(<FaceIdStep onIdentified={onIdentified} onBack={jest.fn()} />);

    fireEvent.click(screen.getByText('survey.kiosk.faceId.scan'));
    await waitFor(() => expect(mockIdentifyMutate).toHaveBeenCalled());

    fireEvent.click(screen.getByText('survey.kiosk.faceId.continue'));
    expect(onIdentified).toHaveBeenCalledWith(mockIdentified, expect.any(Blob));
  });
});
