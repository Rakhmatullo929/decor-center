import { render, screen } from 'src/test-utils';

import QuestionResultCard from '../question-result-card';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

describe('QuestionResultCard', () => {
  it('renders per-option counts for a single-choice question', () => {
    render(
      <QuestionResultCard
        result={{
          id: 1,
          text: 'Favourite?',
          type: 'single',
          options: [
            { id: 'a', text: 'Tea', count: 4 },
            { id: 'b', text: 'Coffee', count: 7 },
          ],
        }}
      />
    );
    expect(screen.getByText('Favourite?')).toBeInTheDocument();
    expect(screen.getByText('Tea')).toBeInTheDocument();
    expect(screen.getByText(/7/)).toBeInTheDocument();
  });

  it('lists free-text answers for a textarea question', () => {
    render(
      <QuestionResultCard
        result={{
          id: 2,
          text: 'Comments?',
          type: 'textarea',
          textValues: ['Great place', 'Needs more parking'],
          responseCount: 2,
        }}
      />
    );
    expect(screen.getByText('Great place')).toBeInTheDocument();
    expect(screen.getByText('Needs more parking')).toBeInTheDocument();
  });
});
