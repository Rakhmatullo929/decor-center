import { fireEvent, render, screen } from 'src/test-utils';

import ThankYouStep from '../thank-you-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

describe('ThankYouStep', () => {
  it('shows the thank-you message and fires onFinish', () => {
    const onFinish = jest.fn();
    render(<ThankYouStep employeeName="Ivan" onFinish={onFinish} />);
    expect(screen.getByText('survey.kiosk.thankYou.title')).toBeInTheDocument();
    fireEvent.click(screen.getByText('survey.kiosk.thankYou.finish'));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
