import { useState } from 'react';

import { fireEvent, render, screen } from 'src/test-utils';

import type { SurveyQuestion } from '../../api/types';
import QuestionStep, { type KioskAnswer } from '../question-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

const questions: SurveyQuestion[] = [
  { id: 1, type: 'single', order: 0, text: 'Pick one?', options: [{ id: 'a', text: 'Alpha' }, { id: 'b', text: 'Beta' }] },
  { id: 2, type: 'textarea', order: 1, text: 'Comments?', options: [] },
];

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const [answers, setAnswers] = useState<Record<number, KioskAnswer>>({});
  return (
    <QuestionStep
      questions={questions}
      answers={answers}
      onAnswer={(id, a) => setAnswers((prev) => ({ ...prev, [id]: a }))}
      onSubmit={onSubmit}
      isSubmitting={false}
    />
  );
}

describe('kiosk QuestionStep', () => {
  it('single-choice keeps Next disabled until one option is picked', () => {
    render(<Harness onSubmit={jest.fn()} />);
    expect(screen.getByText('Pick one?')).toBeInTheDocument();
    const next = screen.getByText('common.actions.next').closest('button');
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByText('Alpha'));
    expect(next).toBeEnabled();
  });

  it('reaches the textarea question and submits', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('common.actions.next'));
    expect(await screen.findByText('Comments?')).toBeInTheDocument();
    // textarea is optional → submit enabled immediately
    fireEvent.click(screen.getByText('common.actions.submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
