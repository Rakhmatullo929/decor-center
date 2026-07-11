import type { TokenPairResponse } from 'src/auth/api/types';

import type { Employee } from '../../employees/api/types';
import type { QuestionSettings, QuestionType, Test } from '../../admin-surveys/api/types';

export type { Employee, Test, QuestionType, QuestionSettings };

export type SurveyOption = { id: string; text: string };

/** Frozen question set returned by `start/` (correct answers never exist). */
export type SurveyQuestion = {
  id: number;
  type: QuestionType;
  order: number;
  text: string;
  options: SurveyOption[];
  settings: QuestionSettings;
  isRequired: boolean;
};

export type SurveyBlock = {
  id: number;
  order: number;
  title: string;
  questions: SurveyQuestion[];
};

export type SurveySessionStatus = 'in_progress' | 'completed' | 'abandoned';

/** Matches Plan 2 `SurveySessionSerializer` (camelCase). No score/passed. */
export type SurveySession = {
  id: number;
  test: number;
  testTitle: string;
  employee: number;
  employeeName: string;
  faceVerified: boolean;
  startedAt: string;
  completedAt: string | null;
  status: SurveySessionStatus;
  /** Answered / total scorable questions (section headers excluded). */
  answeredCount: number;
  totalCount: number;
  /** True only when DECOR_REVERIFY_ON_SUBMIT is on (default off for surveys). */
  requiresSubmitReverify?: boolean;
};

/** One already-saved answer, as returned by session detail / autosave. */
export type SurveyAnswer = {
  question: number;
  questionText: string;
  questionType: QuestionType;
  selectedOptionIds: string[];
  textValue: string;
};

/** `GET /survey-sessions/{id}/` — full state for resuming `/survey/:sessionId`. */
export type SurveySessionDetail = SurveySession & {
  blocks: SurveyBlock[];
  answers: SurveyAnswer[];
};

/** Public identify payload — matches KioskIdentifiedEmployeeSerializer (camelCase). */
export type KioskEmployee = {
  id: number;
  fullName: string;
  specialtyName: string;
  photo: string | null;
  phoneMasked: string;
};

export type RequestOtpResponse = { phoneMasked: string };
/** verify-otp logs the employee in for real (see apps.accounts.tokens.issue_token_pair). */
export type VerifyOtpResponse = TokenPairResponse;
export type EmployeeLookupItem = { id: number; fullName: string };

export type IdentifyEmployeePayload = { faceImage: File };
export type IdentifyEmployeeResponse = { employee: KioskEmployee };

/** Face-ID is verified once, at kiosk entry — starting a specific test needs no camera frame. */
export type StartSurveyPayload = { employee: number; test: number };
export type StartSurveyResponse = { session: SurveySession; test: Test; blocks: SurveyBlock[] };

export type SubmitAnswerItem = {
  question: number;
  selectedOptionIds?: string[];
  textValue?: string;
};

/** Local in-progress answer state for one question, keyed by question id in the form. */
export type KioskAnswer = { selectedOptionIds?: string[]; textValue?: string };

/** `POST /survey-sessions/{id}/answer/` — upserts one Answer without completing the session. */
export type AutosaveAnswerPayload = SubmitAnswerItem;

export type SubmitSurveyPayload = {
  answers: SubmitAnswerItem[];
  /** Base64 data-URL frame for submit-time re-verification (omitted when off). */
  faceImage?: string;
};
