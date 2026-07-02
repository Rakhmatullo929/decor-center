import type { Employee } from '../../employees/api/types';

/** Re-export for consumers who need it via the testing API barrel. */
export type { Employee };

/** Backend `Module` choices (`apps/assessments/models.py`). */
export type TestModule = 'specialty' | 'tech_safety' | 'industrial_safety';

/** Matches `QuestionPublicSerializer` — the correct answer is never exposed. */
export type TestQuestion = {
  id: number;
  module: TestModule;
  text: string;
  options: string[];
  /** Pre-generated server TTS (specialty module). Null/absent → Web Speech fallback. */
  audioUrl?: string | null;
};

/** Matches `TestSessionSerializer` (camelCase). `score`/`passed` are null until submit. */
export type TestSession = {
  id: number;
  employee: number;
  employeeName: string;
  module: TestModule;
  specialty: number | null;
  specialtyName: string | null;
  startedAt: string;
  finishedAt: string | null;
  score: number | null;
  total: number;
  passed: boolean | null;
  faceVerified: boolean;
  /** Submit-time face check: null = not checked, true = matched, false = mismatch. */
  submitFaceVerified: boolean | null;
  /** True when the kiosk must capture a face at submit (server mode log|block). */
  requiresSubmitReverify: boolean;
};

export type StartTestSessionPayload = {
  employee: number;
  module: TestModule;
  /** Live camera frame (jpeg) for the Face ID gate. */
  faceImage: File;
};

export type StartTestSessionResponse = {
  session: TestSession;
  questions: TestQuestion[];
};

export type SubmitAnswerItem = {
  question: number;
  /** Index of the chosen option (0..3). */
  selectedOption: number;
};

export type SubmitTestSessionPayload = {
  answers: SubmitAnswerItem[];
  /** Base64 data-URL camera frame for submit-time re-verification (omitted when off). */
  faceImage?: string;
};

export type IdentifyEmployeePayload = {
  faceImage: File;
};

export type IdentifyEmployeeResponse = {
  employee: Employee;
};
