import { IMPLEMENTED_QUESTION_TYPES } from '../../api/types';
import type { LocalizedText, QuestionType } from '../../api/types';

export type QuestionTypeMeta = {
  type: QuestionType;
  icon: string;
  hasOptions: boolean;
  hasScale: boolean;
  /** section_header is a divider, not an answerable question. */
  hasAnswer: boolean;
};

export const QUESTION_TYPE_META: Record<QuestionType, QuestionTypeMeta> = {
  single: { type: 'single', icon: 'solar:check-circle-bold', hasOptions: true, hasScale: false, hasAnswer: true },
  multiple: {
    type: 'multiple',
    icon: 'solar:checklist-minimalistic-bold',
    hasOptions: true,
    hasScale: false,
    hasAnswer: true,
  },
  short_text: { type: 'short_text', icon: 'solar:pen-2-bold', hasOptions: false, hasScale: false, hasAnswer: true },
  textarea: {
    type: 'textarea',
    icon: 'solar:document-text-bold',
    hasOptions: false,
    hasScale: false,
    hasAnswer: true,
  },
  nps: { type: 'nps', icon: 'solar:graph-up-bold', hasOptions: false, hasScale: true, hasAnswer: true },
  scale5: { type: 'scale5', icon: 'solar:star-bold', hasOptions: false, hasScale: true, hasAnswer: true },
  form_field: {
    type: 'form_field',
    icon: 'solar:clipboard-text-bold',
    hasOptions: false,
    hasScale: false,
    hasAnswer: true,
  },
  signature_date: {
    type: 'signature_date',
    icon: 'solar:pen-new-square-bold',
    hasOptions: false,
    hasScale: false,
    hasAnswer: true,
  },
  section_header: {
    type: 'section_header',
    icon: 'solar:layers-minimalistic-bold',
    hasOptions: false,
    hasScale: false,
    hasAnswer: false,
  },
  // Reserved for future use — shown disabled in the "add question" menu.
  dropdown: { type: 'dropdown', icon: 'solar:list-bold', hasOptions: true, hasScale: false, hasAnswer: true },
  date: { type: 'date', icon: 'solar:calendar-bold', hasOptions: false, hasScale: false, hasAnswer: true },
  number: { type: 'number', icon: 'solar:hashtag-square-bold', hasOptions: false, hasScale: false, hasAnswer: true },
  matrix: { type: 'matrix', icon: 'solar:widget-bold', hasOptions: false, hasScale: false, hasAnswer: true },
  ranking: { type: 'ranking', icon: 'solar:sort-vertical-bold', hasOptions: false, hasScale: false, hasAnswer: true },
  file_upload: {
    type: 'file_upload',
    icon: 'solar:file-send-bold',
    hasOptions: false,
    hasScale: false,
    hasAnswer: true,
  },
};

export const RESERVED_QUESTION_TYPES: QuestionType[] = (
  Object.keys(QUESTION_TYPE_META) as QuestionType[]
).filter((type) => !IMPLEMENTED_QUESTION_TYPES.includes(type));

export function defaultSettingsFor(type: QuestionType) {
  if (type === 'nps') return { min: 0, max: 10 };
  if (type === 'scale5') return { min: 1, max: 5 };
  return {};
}

/**
 * Non-blank default text for a freshly added option ("Вариант 1" / "Variant 1").
 * The backend rejects options with empty text in both languages, so a brand new
 * option can never be saved blank — pre-fill it, the admin edits it afterwards.
 */
export function defaultOptionText(
  t: (key: string, opts?: Record<string, unknown>) => string,
  index: number
): LocalizedText {
  return {
    uz: t('surveys.builder.form.optionLabel', { n: index + 1, lng: 'uz' }),
    ru: t('surveys.builder.form.optionLabel', { n: index + 1, lng: 'ru' }),
  };
}
