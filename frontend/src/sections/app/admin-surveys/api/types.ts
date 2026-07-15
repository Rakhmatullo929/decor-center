export type QuestionType =
  | 'single'
  | 'multiple'
  | 'short_text'
  | 'textarea'
  | 'nps'
  | 'scale5'
  | 'form_field'
  | 'signature_date'
  | 'section_header'
  // Reserved for future use — not yet rendered by the builder or the kiosk.
  | 'dropdown'
  | 'date'
  | 'number'
  | 'matrix'
  | 'ranking'
  | 'file_upload';

/** Question types the builder can fully create/edit today. */
export const IMPLEMENTED_QUESTION_TYPES: QuestionType[] = [
  'single',
  'multiple',
  'short_text',
  'textarea',
  'nps',
  'scale5',
  'form_field',
  'signature_date',
  'section_header',
];

/** Stable option id survives reordering so analytics don't drift (spec §4.1). */
export type TestOption = { id: string; text: string };

/** Type-specific config: scale bounds/labels, placeholders, form field kind, etc. */
export type QuestionSettings = {
  min?: number;
  max?: number;
  leftLabel?: string;
  rightLabel?: string;
  placeholder?: string;
  fieldType?: 'text' | 'date';
  [key: string]: unknown;
};

/** Matches Plan 2 `TestSerializer` (camelCase). */
export type Test = {
  id: number;
  title: string;
  isActive: boolean;
  isAdminConducted: boolean;
  isAfterApplication: boolean;
  afterDays: number | null;
  testDaysFrom: number | null;
  testDaysTo: number | null;
  month: number[];
  /** Nested read-only tree (blocks + their questions) — present on detail fetches. */
  blocks?: QuestionBlock[];
};

export type TestListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  ordering?: string;
  isActive?: boolean;
};

/** Matches Plan 2 `QuestionBlockSerializer`. */
export type QuestionBlock = {
  id: number;
  test: number;
  order: number;
  title: string;
  questions?: Question[];
};

export type QuestionBlockUpsertPayload = {
  test: number;
  order: number;
  title: string;
};

/** Matches Plan 2 `QuestionSerializer`. */
export type Question = {
  id: number;
  block: number;
  type: QuestionType;
  order: number;
  text: string;
  options: TestOption[];
  settings: QuestionSettings;
  isRequired: boolean;
  isMindDive: boolean;
};

export type QuestionUpsertPayload = {
  block: number;
  type: QuestionType;
  order: number;
  text: string;
  options: TestOption[];
  settings?: QuestionSettings;
  isRequired?: boolean;
  isMindDive?: boolean;
};

export type ReorderQuestionBlocksPayload = { test: number; order: number[] };
export type ReorderQuestionsPayload = { block: number; order: number[] };
export type MoveQuestionPayload = { question: number; targetBlock: number; order: number[] };

/**
 * Matches Plan 2 `survey-sessions/results/` aggregate serializer:
 * `{ test: {id,title}, blocks: [{id, title, questions: [...] }] }`.
 * (Deviation from the frontend plan draft, which used a flat `questions[]`
 * shape with `question`/`textAnswers`/`sessionCount` — those keys do not
 * exist in the real backend response.)
 */
export type ResultOption = { id: string; text: string; count: number };

/** Present for nps/scale5: rating distribution + average. */
export type ScaleResult = {
  min: number;
  max: number;
  /** Response count per rating value, keyed by the value as a string (e.g. "7"). */
  counts: Record<string, number>;
  responseCount: number;
  average: number | null;
};

export type QuestionResult = {
  id: number;
  text: string;
  type: QuestionType;
  /** Present for single/multiple: per-option selection counts. */
  options?: ResultOption[];
  /** Present for textarea/short_text/form_field/signature_date: free-text answers. */
  textValues?: string[];
  /** Present alongside textValues: number of non-empty answers. */
  responseCount?: number;
  /** Present for nps/scale5. */
  scale?: ScaleResult;
};

export type ResultBlock = {
  id: number;
  title: string;
  questions: QuestionResult[];
};

export type SurveyResults = {
  test: { id: number; title: string };
  blocks: ResultBlock[];
};

export type ResultsParams = { test: number };
export type ResultsExportParams = { test: number };

export type SurveySessionStatus = 'in_progress' | 'completed' | 'abandoned';

/** Matches `SurveySessionSerializer` — one employee's attempt at one test, admin view. */
export type SurveySessionAdmin = {
  id: number;
  employee: number;
  employeeName: string;
  test: number;
  testTitle: string;
  createdBy: number | null;
  faceVerified: boolean;
  modelVersion: string;
  startedAt: string;
  completedAt: string | null;
  status: SurveySessionStatus;
};

export type SurveySessionListParams = { test?: number };

/** Matches `AnswerReadSerializer` — one raw answer row within a session detail. */
export type SessionAnswer = {
  question: number;
  questionText: string;
  questionType: QuestionType;
  selectedOptionIds: string[];
  textValue: string;
};

/** Question as presented to the employee, frozen at session start (`QuestionPublicSerializer`). */
export type SessionQuestion = {
  id: number;
  type: QuestionType;
  order: number;
  text: string;
  options: TestOption[];
  settings: QuestionSettings;
  isRequired: boolean;
  isMindDive: boolean;
};

export type SessionBlock = {
  id: number;
  test: number;
  order: number;
  title: string;
  questions: SessionQuestion[];
};

/** Matches `SurveySessionDetailSerializer` — one employee's full attempt, question-by-question. */
export type SurveySessionDetail = SurveySessionAdmin & {
  answers: SessionAnswer[];
  blocks: SessionBlock[];
};
