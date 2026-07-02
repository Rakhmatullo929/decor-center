export type QuestionModule = 'specialty' | 'tech_safety' | 'industrial_safety';

export type QuestionSource = 'ai' | 'manual';

export type QuestionStatus = 'draft' | 'approved';

/** Matches `QuestionAdminSerializer` (camelCase) — admin only, includes the correct answer. */
export type Question = {
  id: number;
  module: QuestionModule;
  /** Required when module === 'specialty', null for safety modules (backend enforces). */
  specialty: number | null;
  specialtyName: string | null;
  text: string;
  /** Exactly 4 answer options. */
  options: string[];
  /** Index 0-3 of the correct option. */
  correctOption: number;
  source: QuestionSource;
  status: QuestionStatus;
  createdAt: string;
};

export type QuestionListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  ordering?: string;
  module?: string;
  specialty?: number;
  status?: string;
  source?: string;
};

export type QuestionUpsertPayload = {
  module: QuestionModule;
  specialty: number | null;
  text: string;
  options: string[];
  correctOption: number;
};
