export type QuestionType = 'single' | 'multiple' | 'textarea';

/** Stable option id survives reordering so analytics don't drift (spec §4.1). */
export type TestOption = { id: string; text: string };

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
};

export type TestListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  ordering?: string;
  isActive?: boolean;
};

export type TestUpsertPayload = {
  title: string;
  isActive: boolean;
  isAdminConducted: boolean;
  isAfterApplication: boolean;
  afterDays: number | null;
  testDaysFrom: number | null;
  testDaysTo: number | null;
  month: number[];
};

/** Matches Plan 2 `QuestionBlockSerializer`. */
export type QuestionBlock = {
  id: number;
  test: number;
  order: number;
  title: string;
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
};

export type QuestionUpsertPayload = {
  block: number;
  type: QuestionType;
  order: number;
  text: string;
  options: TestOption[];
};

/**
 * Matches Plan 2 `survey-sessions/results/` aggregate serializer:
 * `{ test: {id,title}, blocks: [{id, title, questions: [...] }] }`.
 * (Deviation from the frontend plan draft, which used a flat `questions[]`
 * shape with `question`/`textAnswers`/`sessionCount` — those keys do not
 * exist in the real backend response.)
 */
export type ResultOption = { id: string; text: string; count: number };

export type QuestionResult = {
  id: number;
  text: string;
  type: QuestionType;
  /** Present for single/multiple: per-option selection counts. */
  options?: ResultOption[];
  /** Present for textarea: raw free-text answers. */
  textValues?: string[];
  /** Present for textarea: number of non-empty answers. */
  responseCount?: number;
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
