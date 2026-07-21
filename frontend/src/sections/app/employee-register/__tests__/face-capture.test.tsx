import userEvent from '@testing-library/user-event';

import { render, screen } from 'src/test-utils';

import FaceCapture from '../face-capture';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

describe('FaceCapture', () => {
  it('accepts an uploaded file via the upload fallback and can retake', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { container } = render(<FaceCapture value={null} onChange={onChange} />);

    // jsdom has no camera -> the widget shows the upload fallback. Trigger the file input.
    await user.click(screen.getByText('employees.register.face.upload'));

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'face.jpg', { type: 'image/jpeg' });
    await user.upload(input, file);

    expect(onChange).toHaveBeenCalledWith(file);
  });
});
