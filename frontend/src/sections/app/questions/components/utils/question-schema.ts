import * as Yup from 'yup';

import type { QuestionModule } from '../../api/types';
import { QUESTION_MODULES } from './question-constants';

export type QuestionFormValues = {
  module: QuestionModule | '';
  /** Visible (and required) only when module === 'specialty'. */
  specialty: number | '';
  text: string;
  /** Exactly 4 answer options (A-D). */
  options: string[];
  /** Index 0-3 of the correct option. */
  correctOption: number | '';
};

export function buildQuestionSchema(tx: (key: string) => string) {
  return Yup.object().shape({
    module: Yup.string()
      .oneOf(QUESTION_MODULES, tx('questions.validation.moduleRequired'))
      .required(tx('questions.validation.moduleRequired')),
    specialty: Yup.mixed<number | ''>().test(
      'specialty-required',
      tx('questions.validation.specialtyRequired'),
      (value, context) => context.parent.module !== 'specialty' || typeof value === 'number'
    ),
    text: Yup.string().trim().required(tx('questions.validation.textRequired')),
    options: Yup.array()
      .of(Yup.string().trim().required(tx('questions.validation.optionRequired')))
      .length(4)
      .required(),
    correctOption: Yup.number()
      .typeError(tx('questions.validation.correctOptionRequired'))
      .min(0)
      .max(3)
      .required(tx('questions.validation.correctOptionRequired')),
  });
}
