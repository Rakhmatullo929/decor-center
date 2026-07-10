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

describe('SurveyForm wizard', () => {
  it('shows one block at a time, starting on the first', () => {
    render(<Harness onSubmit={jest.fn()} />);
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.queryByText('Q2')).not.toBeInTheDocument();
    expect(screen.queryByText('Q3')).not.toBeInTheDocument();
  });

  it('blocks Next until the current block’s required question is answered', () => {
    render(<Harness onSubmit={jest.fn()} />);

    next();
    // Gate holds: still on block 1, block 2 not revealed.
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.queryByText('Q2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Ans A'));
    next();

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

  it('gates the final Submit and only fires onSubmit once the last block is complete', () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText('Ans A')); // block 1
    next();
    next(); // block 2 has no required questions
    expect(screen.getByText('Q3')).toBeInTheDocument();

    const submit = () => fireEvent.click(screen.getByRole('button', { name: 'common.actions.submit' }));
    submit();
    expect(onSubmit).not.toHaveBeenCalled(); // Q3 still empty

    fireEvent.click(screen.getByText('Ans C'));
    submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('lets the employee jump back to a completed section from the rail', () => {
    render(<Harness onSubmit={jest.fn()} />);
    fireEvent.click(screen.getByText('Ans A'));
    next();
    expect(screen.getByText('Q2')).toBeInTheDocument();

    const rail = screen.getByRole('navigation');
    fireEvent.click(within(rail).getByRole('button', { name: /II\. LOYALTY/ }));
    expect(screen.getByText('Q1')).toBeInTheDocument();
  });

  it('locks sections the employee has not reached yet', () => {
    render(<Harness onSubmit={jest.fn()} />);
    const rail = screen.getByRole('navigation');
    expect(within(rail).getByRole('button', { name: /IV\. FINAL/ })).toBeDisabled();
  });
});
