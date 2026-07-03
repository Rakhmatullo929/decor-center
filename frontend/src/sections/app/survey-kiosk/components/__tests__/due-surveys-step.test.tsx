import { fireEvent, render, screen } from 'src/test-utils';

import DueSurveysStep from '../due-surveys-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

const tests = [
  { id: 1, title: 'Onboarding 30d', isActive: true, isAdminConducted: false, isAfterApplication: true, afterDays: 30, testDaysFrom: null, testDaysTo: null, month: [] },
  { id: 2, title: 'Monthly Pulse', isActive: true, isAdminConducted: false, isAfterApplication: false, afterDays: null, testDaysFrom: 1, testDaysTo: 7, month: [1] },
];

describe('DueSurveysStep', () => {
  it('renders due surveys and fires onPick', () => {
    const onPick = jest.fn();
    render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <DueSurveysStep tests={tests as any} isLoading={false} employeeName="Ivan" onPick={onPick} onBack={jest.fn()} />
    );
    expect(screen.getByText('Onboarding 30d')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Monthly Pulse'));
    expect(onPick).toHaveBeenCalledWith(tests[1]);
  });

  it('shows the empty state when nothing is due', () => {
    render(
      <DueSurveysStep tests={[]} isLoading={false} employeeName="Ivan" onPick={jest.fn()} onBack={jest.fn()} />
    );
    expect(screen.getByText('survey.kiosk.due.empty')).toBeInTheDocument();
  });
});
