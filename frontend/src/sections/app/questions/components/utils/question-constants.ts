import type { QuestionModule } from '../../api/types';

/** Order matters: it drives the module select and filter options. */
export const QUESTION_MODULES: QuestionModule[] = ['specialty', 'tech_safety', 'industrial_safety'];

/** Shared module captions (`common.modules.*`) reused by table, filters and form. */
export const QUESTION_MODULE_LABELS: Record<QuestionModule, string> = {
  specialty: 'common.modules.specialty',
  tech_safety: 'common.modules.techSafety',
  industrial_safety: 'common.modules.industrialSafety',
};

/** A-D captions for the 4 answer options (indexes 0-3 on the backend). */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
