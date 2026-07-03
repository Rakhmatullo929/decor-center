import type { Employee } from '../../employees/api/types';
import type { QuestionType, Test } from '../../admin-surveys/api/types';

export type { Employee, Test, QuestionType };

export type SurveyOption = { id: string; text: string };

/** Frozen question set returned by `start/` (correct answers never exist). */
export type SurveyQuestion = {
  id: number;
  type: QuestionType;
  order: number;
  text: string;
  options: SurveyOption[];
};

export type SurveyBlock = {
  id: number;
  order: number;
  title: string;
  questions: SurveyQuestion[];
};

/** Matches Plan 2 `SurveySessionSerializer` (camelCase). No score/passed. */
export type SurveySession = {
  id: number;
  test: number;
  employee: number;
  employeeName: string;
  faceVerified: boolean;
  startedAt: string;
  completedAt: string | null;
  /** True only when DECOR_REVERIFY_ON_SUBMIT is on (default off for surveys). */
  requiresSubmitReverify?: boolean;
};

export type IdentifyEmployeePayload = { faceImage: File };
export type IdentifyEmployeeResponse = { employee: Employee };

export type StartSurveyPayload = { employee: number; test: number; faceImage: File };
export type StartSurveyResponse = { session: SurveySession; test: Test; blocks: SurveyBlock[] };

export type SubmitAnswerItem = {
  question: number;
  selectedOptionIds?: string[];
  textValue?: string;
};

export type SubmitSurveyPayload = {
  answers: SubmitAnswerItem[];
  /** Base64 data-URL frame for submit-time re-verification (omitted when off). */
  faceImage?: string;
};
