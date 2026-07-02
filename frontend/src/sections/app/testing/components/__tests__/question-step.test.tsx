import { useState } from 'react';

import { fireEvent, render, screen } from 'src/test-utils';

import type { TestModule, TestQuestion } from '../../api/types';
import QuestionStep from '../question-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

const questions: TestQuestion[] = [
  { id: 1, module: 'tech_safety', text: 'Question one?', options: ['A1', 'B1', 'C1'] },
  { id: 2, module: 'tech_safety', text: 'Question two?', options: ['A2', 'B2', 'C2'] },
];

const speakMock = jest.fn();
const cancelMock = jest.fn();
const playMock = jest.fn().mockResolvedValue(undefined);
const pauseMock = jest.fn();

beforeAll(() => {
  // jsdom does not implement the Web Speech API.
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak: speakMock, cancel: cancelMock },
  });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    function SpeechSynthesisUtteranceMock(this: { text: string; lang: string }, text: string) {
      this.text = text;
      this.lang = '';
    };
});

afterAll(() => {
  delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  delete (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
});

/** Holds the answers state the way the wizard view does. */
function Harness({ module, onSubmit }: { module: TestModule; onSubmit: () => void }) {
  const [answers, setAnswers] = useState<Partial<Record<number, number>>>({});
  return (
    <QuestionStep
      questions={questions}
      module={module}
      answers={answers}
      onAnswer={(questionId, option) => setAnswers((prev) => ({ ...prev, [questionId]: option }))}
      onSubmit={onSubmit}
      isSubmitting={false}
    />
  );
}

describe('QuestionStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    playMock.mockResolvedValue(undefined);
    // Re-apply each test: CRA Jest resets mock implementations, and jsdom's
    // window.Audio is otherwise non-writable.
    Object.defineProperty(window, 'Audio', {
      configurable: true,
      writable: true,
      value: jest
        .fn()
        .mockImplementation((src: string) => ({ src, play: playMock, pause: pauseMock, currentTime: 0 })),
    });
  });

  it('renders the question text, options and the progress key', () => {
    render(<Harness module="tech_safety" onSubmit={jest.fn()} />);

    expect(screen.getByText('testing.questions.progress')).toBeInTheDocument();
    expect(screen.getByText('Question one?')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(screen.getByText('C1')).toBeInTheDocument();
  });

  it('fires onAnswer with the question id and option index', () => {
    const onAnswer = jest.fn();
    render(
      <QuestionStep
        questions={questions}
        module="tech_safety"
        answers={{}}
        onAnswer={onAnswer}
        onSubmit={jest.fn()}
        isSubmitting={false}
      />
    );

    fireEvent.click(screen.getByText('B1'));

    expect(onAnswer).toHaveBeenCalledWith(1, 1);
  });

  it('keeps Next disabled until an option is chosen, then advances', async () => {
    render(<Harness module="tech_safety" onSubmit={jest.fn()} />);

    const nextButton = screen.getByText('common.actions.next').closest('button');
    expect(nextButton).toBeDisabled();

    fireEvent.click(screen.getByText('A1'));
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton as HTMLButtonElement);
    // The question is wrapped in AnimatePresence, so it mounts after the transition.
    expect(await screen.findByText('Question two?')).toBeInTheDocument();
  });

  it('triggers the submit callback on the last question', async () => {
    const onSubmit = jest.fn();
    render(<Harness module="tech_safety" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText('A1'));
    fireEvent.click(screen.getByText('common.actions.next'));

    const submitButton = screen.getByText('common.actions.submit').closest('button');
    expect(submitButton).toBeDisabled();

    fireEvent.click(await screen.findByText('C2'));
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton as HTMLButtonElement);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('auto-reads the question and shows the replay button for the specialty module', () => {
    render(<Harness module="specialty" onSubmit={jest.fn()} />);

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock.mock.calls[0][0]).toMatchObject({ text: 'Question one?', lang: 'uz-UZ' });

    const replayButton = screen.getByRole('button', { name: 'testing.questions.replay' });
    fireEvent.click(replayButton);
    expect(speakMock).toHaveBeenCalledTimes(2);
  });

  it('does not use TTS for non-specialty modules', () => {
    render(<Harness module="tech_safety" onSubmit={jest.fn()} />);

    expect(speakMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'testing.questions.replay' })
    ).not.toBeInTheDocument();
  });

  it('plays the server audio file when audioUrl is present (specialty)', () => {
    const audioQuestions: TestQuestion[] = [
      { id: 1, module: 'specialty', text: 'Voiced?', options: ['A', 'B', 'C', 'D'], audioUrl: 'http://x/1.mp3' },
    ];
    render(
      <QuestionStep
        questions={audioQuestions}
        module="specialty"
        answers={{}}
        onAnswer={jest.fn()}
        onSubmit={jest.fn()}
        isSubmitting={false}
      />
    );

    expect(window.Audio).toHaveBeenCalledWith('http://x/1.mp3');
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(speakMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'testing.questions.replay' }));
    expect(playMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to Web Speech when audioUrl is absent (specialty)', () => {
    render(<Harness module="specialty" onSubmit={jest.fn()} />);

    expect(playMock).not.toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalledTimes(1);
  });
});
