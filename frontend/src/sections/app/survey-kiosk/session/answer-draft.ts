import { localStorageAvailable } from 'src/utils/storage-available';
import type { KioskAnswer } from '../api/types';

/**
 * Short-lived, synchronous local backup of the in-progress answers, keyed per session. Written on
 * every keystroke/selection so an accidental refresh restores the last characters an autosave
 * debounce had not yet sent. It is deliberately a "last few keystrokes" buffer, not long-term
 * storage: the backend (loaded on resume) is the source of truth, so drafts expire quickly and
 * are swept, and a draft never overwrites an existing server answer.
 */
const PREFIX = 'decor.survey.draft.';

/** Drafts older than this are ignored and pruned — long enough to survive an accidental reload,
 *  short enough that a later resume (incl. edits made on another device) prefers the server. */
const MAX_AGE_MS = 30 * 60 * 1000;

type StoredDraft = { savedAt: number; answers: Record<number, KioskAnswer> };

const keyFor = (sessionId: number | string) => `${PREFIX}${sessionId}`;

function readRaw(key: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.savedAt !== 'number' ||
      !parsed.answers ||
      typeof parsed.answers !== 'object'
    ) {
      return null;
    }
    return parsed as StoredDraft;
  } catch {
    return null;
  }
}

/** Keep only well-formed per-answer entries, so a tampered/partial draft can't crash seeding. */
function sanitize(answers: Record<string, unknown>): Record<number, KioskAnswer> {
  const out: Record<number, KioskAnswer> = {};
  Object.entries(answers).forEach(([id, value]) => {
    if (value && typeof value === 'object') out[Number(id)] = value as KioskAnswer;
  });
  return out;
}

export function loadAnswerDraft(sessionId: number | string): Record<number, KioskAnswer> {
  if (!sessionId || !localStorageAvailable()) return {};
  const draft = readRaw(keyFor(sessionId));
  if (!draft || Date.now() - draft.savedAt > MAX_AGE_MS) return {};
  return sanitize(draft.answers);
}

export function saveAnswerDraft(
  sessionId: number | string,
  answers: Record<number, KioskAnswer>
): void {
  if (!sessionId || !localStorageAvailable()) return;
  // Nothing entered yet — don't leave an empty key behind for every scan-and-walk-away.
  if (Object.keys(answers).length === 0) {
    clearAnswerDraft(sessionId);
    return;
  }
  const payload = JSON.stringify({ savedAt: Date.now(), answers });
  try {
    window.localStorage.setItem(keyFor(sessionId), payload);
  } catch {
    // Likely quota: reclaim space from stale drafts and retry once so THIS session still persists.
    pruneExpiredDrafts();
    try {
      window.localStorage.setItem(keyFor(sessionId), payload);
    } catch {
      /* still failing — draft is best-effort, give up silently */
    }
  }
}

export function clearAnswerDraft(sessionId: number | string): void {
  if (!sessionId || !localStorageAvailable()) return;
  try {
    window.localStorage.removeItem(keyFor(sessionId));
  } catch {
    /* ignore */
  }
}

/** Sweep expired/corrupt drafts so a shared kiosk never accumulates them toward the storage quota. */
export function pruneExpiredDrafts(): void {
  if (!localStorageAvailable()) return;
  try {
    const now = Date.now();
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        const draft = readRaw(key);
        if (!draft || now - draft.savedAt > MAX_AGE_MS) stale.push(key);
      }
    }
    stale.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}
