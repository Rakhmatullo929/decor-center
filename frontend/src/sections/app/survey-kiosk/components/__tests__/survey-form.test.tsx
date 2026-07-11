import { useState } from 'react';

import { fireEvent, render, screen, within } from 'src/test-utils';

import type { AutosaveAnswerPayload, KioskAnswer } from '../../api/types';
import SurveyForm from '../survey-form';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

// jsdom has no scrollIntoView; the wizard calls it on every step change / validation.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

const blocks = [
  {
    id: 1,
    order: 1,
    title: 'II. LOYALTY',
    questions: [
      {
        id: 10,
        type: 'single',
        order: 1,
        text: 'Q1',
        isRequired: true,
        settings: {},
        options: [
          { id: 'a', text: 'Ans A' },
          { id: 'b', text: 'Ans B' },
        ],
      },
    ],
  },
  {
    id: 2,
    order: 2,
    title: 'III. MOTIVATION',
    questions: [{ id: 20, type: 'short_text', order: 1, text: 'Q2', isRequired: false, settings: {}, options: [] }],
  },
  {
    id: 3,
    order: 3,
    title: 'IV. FINAL',
    questions: [
      { id: 30, type: 'single', order: 1, text: 'Q3', isRequired: true, settings: {}, options: [{ id: 'c', text: 'Ans C' }] },
    ],
  },
];

/** Mirrors survey-form-view: answers live in the parent, so onAnswer feeds them back. */
function Harness({ onSubmit }: { onSubmit: () => void }) {
  const [answers, setAnswers] = useState<Record<number, KioskAnswer>>({});
  const handleAnswer = (item: AutosaveAnswerPayload) =>
    setAnswers((prev) => ({
      ...prev,
      [item.question]: { selectedOptionIds: item.selectedOptionIds, textValue: item.textValue },
    }));
  return (
    <SurveyForm
      testTitle="Deep survey"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blocks={blocks as any}
      answers={answers}
      autosaveStatusByQuestion={{}}
      onAnswer={handleAnswer}
      onSubmit={onSubmit}
      isSubmitting={false}
    />
  );
}

const next = () => fireEvent.click(screen.getByRole('button', { name: 'common.actions.next' }));
const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: 'common.actions.submit' }));

describe('SurveyForm wizard', () => {
  it('shows one block at a time, starting on the first', () => {
    render(<Harness onSubmit={jest.fn()} />);
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.queryByText('Q2')).not.toBeInTheDocument();
    expect(screen.queryByText('Q3')).not.toBeInTheDocument();
  });

  it('advances with Next even when the required question is unanswered (free navigation)', () => {
    render(<Harness onSubmit={jest.fn()} />);

    next(); // no answer given — navigation is no longer gated
    expect(screen.queryByText('Q1')).not.toBeInTheDocument();
    expect(screen.getByText('Q2')).toBeInTheDocument();
  });

  it('Back returns to the previous block', () => {
    render(<Harness onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByText('Ans A'));
    next();
    expect(screen.getByText('Q2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.actions.back' }));
    expect(screen.getByText('Q1')).toBeInTheDocument();
  });

  it('lets the employee open any section directly from the rail (no locks)', () => {
    render(<Harness onSubmit={jest.fn()} />);
    const rail = screen.getByRole('navigation');
    const finalBtn = within(rail).getByRole('button', { name: /IV\. FINAL/ });
    expect(finalBtn).not.toBeDisabled();

    fireEvent.click(finalBtn);
    expect(screen.getByText('Q3')).toBeInTheDocument();
  });

  it('lets the employee jump back to an earlier section from the rail', () => {
    render(<Harness onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByText('Ans A'));
    next();
    expect(screen.getByText('Q2')).toBeInTheDocument();

    const rail = screen.getByRole('navigation');
    fireEvent.click(within(rail).getByRole('button', { name: /II\. LOYALTY/ }));
    expect(screen.getByText('Q1')).toBeInTheDocument();
  });

  it('submit fires only once every required question across all blocks is answered', () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);
    const rail = screen.getByRole('navigation');

    fireEvent.click(screen.getByText('Ans A')); // block 1 done
    fireEvent.click(within(rail).getByRole('button', { name: /IV\. FINAL/ })); // jump to last block

    submit();
    expect(onSubmit).not.toHaveBeenCalled(); // Q3 still empty → stays on block 3
    expect(screen.getByText('Q3')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Ans C'));
    submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submit jumps to the first block with a missing required answer', () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);
    const rail = screen.getByRole('navigation');

    // Reach the last block and answer it, leaving block 1's required question empty.
    fireEvent.click(within(rail).getByRole('button', { name: /IV\. FINAL/ }));
    fireEvent.click(screen.getByText('Ans C'));

    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Q1')).toBeInTheDocument(); // jumped back to the first gap
  });
});
