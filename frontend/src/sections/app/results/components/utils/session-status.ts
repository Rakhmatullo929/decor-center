import type { LabelColor } from 'src/components/label';

export type SessionStatus = {
  color: LabelColor;
  /** Translation key for the status label. */
  labelKey: string;
};

/** `passed` is null while the session is still in progress (SRS §8.1.5). */
export function getSessionStatus(passed: boolean | null): SessionStatus {
  if (passed === null) {
    return { color: 'warning', labelKey: 'results.status.inProgress' };
  }
  if (passed) {
    return { color: 'success', labelKey: 'common.status.passed' };
  }
  return { color: 'error', labelKey: 'common.status.failed' };
}
