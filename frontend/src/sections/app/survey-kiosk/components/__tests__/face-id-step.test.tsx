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

const identified = { id: 3, fullName: 'Ivan', specialtyName: 'Fitter', photo: null };
const identifyMutate = jest.fn((_vars, opts) => opts.onSuccess({ employee: identified }));
jest.mock('../../api/use-survey-kiosk-api', () => ({
  useIdentifyEmployeeMutation: () => ({ mutate: identifyMutate, isPending: false }),
}));
jest.mock('src/auth/api', () => ({
  useLogoutMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
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
    await waitFor(() => expect(identifyMutate).toHaveBeenCalled());

    fireEvent.click(screen.getByText('survey.kiosk.faceId.continue'));
    expect(onIdentified).toHaveBeenCalledWith(identified, expect.any(Blob));
  });
});
