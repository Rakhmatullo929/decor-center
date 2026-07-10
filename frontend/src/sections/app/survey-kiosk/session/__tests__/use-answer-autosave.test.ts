import { act, renderHook } from '@testing-library/react';

import { useAutosaveAnswerMutation } from '../../api/use-survey-kiosk-api';
import { useAnswerAutosave } from '../use-answer-autosave';

jest.mock('../../api/use-survey-kiosk-api', () => ({
  useAutosaveAnswerMutation: jest.fn(),
}));

const mockMutate = jest.fn();

beforeEach(() => {
  (useAutosaveAnswerMutation as jest.Mock).mockReturnValue({ mutate: mockMutate });
  mockMutate.mockClear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});

describe('useAnswerAutosave', () => {
  it('saves a choice answer immediately (no debounce)', () => {
    const { result } = renderHook(() => useAnswerAutosave('5'));
    act(() => {
      result.current.saveAnswer(1, { question: 1, selectedOptionIds: ['a'] }, { immediate: true });
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toEqual({
      sessionId: '5',
      item: { question: 1, selectedOptionIds: ['a'] },
    });
  });

  it('debounces text edits and coalesces rapid keystrokes into one save (latest wins)', () => {
    const { result } = renderHook(() => useAnswerAutosave('5'));
    act(() => result.current.saveAnswer(2, { question: 2, textValue: 'a' }));
    act(() => result.current.saveAnswer(2, { question: 2, textValue: 'ab' }));
    expect(mockMutate).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(400));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0].item.textValue).toBe('ab');
  });

  it('flushPending sends the pending text now and cancels the queued timer', () => {
    const { result } = renderHook(() => useAnswerAutosave('5'));
    act(() => result.current.saveAnswer(3, { question: 3, textValue: 'draft' }));

    act(() => result.current.flushPending());
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0].item.textValue).toBe('draft');

    act(() => jest.advanceTimersByTime(400)); // no double-send
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('flushes pending text when the page is hidden (refresh / tab close)', () => {
    const { result } = renderHook(() => useAnswerAutosave('5'));
    act(() => result.current.saveAnswer(4, { question: 4, textValue: 'x' }));

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0].item.textValue).toBe('x');
  });
});
