import { render, screen } from 'src/test-utils';

import KioskEntryView from '../entry-view';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));
jest.mock('../api/use-survey-kiosk-api', () => ({
  useKioskEmployeesQuery: () => ({ data: { results: [], count: 0 }, isPending: false }),
  useDueSurveysQuery: () => ({ data: [], isPending: false }),
  useStartSurveyMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

describe('KioskEntryView', () => {
  it('starts on the employee step', () => {
    render(<KioskEntryView />);
    expect(screen.getByText('survey.kiosk.steps.employee')).toBeInTheDocument();
  });
});
