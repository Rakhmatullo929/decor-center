import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutosaveAnswerPayload } from '../api/types';
import { useAutosaveAnswerMutation } from '../api/use-survey-kiosk-api';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 400;

/**
 * Saves choice-type answers immediately and coalesces rapid text edits with a short (~400ms)
 * debounce, so the backend gets every answer without a request per keystroke. When the page is
 * hidden or unloaded (refresh / tab close) any pending text save is flushed — best-effort, since
 * a request started during unload may be dropped by the browser. The guaranteed "never lose a
 * keystroke" path is the synchronous localStorage draft (see answer-draft); the final `submit`
 * also re-sends the full answer set. This hook only handles backend persistence + status.
 */
export function useAnswerAutosave(sessionId: number | string) {
  const { mutate } = useAutosaveAnswerMutation();
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<number, AutosaveAnswerPayload>>({});
  const mounted = useRef(true);
  const [statusByQuestion, setStatusByQuestion] = useState<Record<number, AutosaveStatus>>({});

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  // React Query still invokes a mutate call's callbacks after this hook unmounts (e.g. an autosave
  // resolving while the kiosk is already returning to the scanner) — guard so we never set state then.
  const setStatus = useCallback((questionId: number, status: AutosaveStatus) => {
    if (mounted.current) setStatusByQuestion((prev) => ({ ...prev, [questionId]: status }));
  }, []);

  const flush = useCallback(
    (questionId: number, item: AutosaveAnswerPayload) => {
      clearTimeout(timers.current[questionId]);
      delete timers.current[questionId];
      delete pending.current[questionId];
      setStatus(questionId, 'saving');
      mutate(
        { sessionId, item },
        {
          onSuccess: () => setStatus(questionId, 'saved'),
          onError: () => setStatus(questionId, 'error'),
        }
      );
    },
    [mutate, sessionId, setStatus]
  );

  /** Fire every still-pending debounced save right now (e.g. before the tab is hidden). */
  const flushPending = useCallback(() => {
    Object.entries(pending.current).forEach(([id, item]) => flush(Number(id), item));
  }, [flush]);

  const saveAnswer = useCallback(
    (questionId: number, item: AutosaveAnswerPayload, opts?: { immediate?: boolean }) => {
      clearTimeout(timers.current[questionId]);
      if (opts?.immediate) {
        flush(questionId, item);
        return;
      }
      pending.current[questionId] = item;
      setStatus(questionId, 'saving');
      timers.current[questionId] = setTimeout(() => flush(questionId, item), DEBOUNCE_MS);
    },
    [flush, setStatus]
  );

  // Never lose the last keystrokes: flush pending saves when the page is hidden or unloaded.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };
    const timersRef = timers.current;
    window.addEventListener('pagehide', flushPending);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      document.removeEventListener('visibilitychange', onVisibility);
      Object.values(timersRef).forEach(clearTimeout);
    };
  }, [flushPending]);

  return { saveAnswer, flushPending, statusByQuestion };
}
