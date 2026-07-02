/** Assessment module codes (`Module` TextChoices). Humps camelizes keys only — values stay snake_case. */
export type ModuleCode = 'specialty' | 'tech_safety' | 'industrial_safety';

/** Matches `TestSessionSerializer` (camelCase). */
export type TestSessionRow = {
  id: number;
  employee: number;
  employeeName: string;
  module: ModuleCode;
  /** Snapshot of the employee's specialty for module 1; null for safety modules. */
  specialty: number | null;
  specialtyName: string | null;
  startedAt: string;
  /** Null while the session is still in progress. */
  finishedAt: string | null;
  /** Null until the session is finished. */
  score: number | null;
  total: number;
  /** Null until the session is finished. */
  passed: boolean | null;
  /** Still returned by the API (used by the detail view and testing flow); not shown in the list table. */
  faceVerified: boolean;
  /** Submit-time face re-verification: null = not checked, true = matched, false = mismatch. */
  submitFaceVerified: boolean | null;
  /** True when REVERIFY_ON_SUBMIT is enabled (log/block); gates display of submitFaceVerified. */
  requiresSubmitReverify: boolean;
};

/** Matches `TestAnswerSerializer` — admin-only breakdown including the correct answer. */
export type TestAnswer = {
  question: number;
  questionText: string;
  /** Exactly 4 answer options. */
  questionOptions: string[];
  /** Null when the employee left the question unanswered. */
  selectedOption: number | null;
  correctOption: number;
  /** Null while the session is still in progress. */
  isCorrect: boolean | null;
};

/** Matches `TestSessionDetailSerializer` (camelCase). */
export type TestSessionDetail = TestSessionRow & {
  answers: TestAnswer[];
};

export type ResultListParams = {
  page?: number;
  pageSize?: number;
  employee?: number;
  module?: ModuleCode;
  /** Employee's specialty snapshot; only meaningful on the `specialty` module. */
  specialty?: number;
  passed?: boolean;
  /** ISO date string (YYYY-MM-DD) — filter sessions that started on this day. */
  date?: string;
  /** Backend ordering field, e.g. "employee__full_name", "-score", "-started_at". */
  ordering?: string;
};

/** XLSX export takes the same filters, without pagination (SRS §8.1.6). */
export type ResultExportParams = Omit<ResultListParams, 'page' | 'pageSize' | 'ordering'>;
