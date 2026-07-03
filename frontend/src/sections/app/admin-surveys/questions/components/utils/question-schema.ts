import * as Yup from 'yup';

import type { QuestionType, TestOption } from '../../../api/types';

export type QuestionFormValues = {
  type: QuestionType;
  order: number;
  text: string;
  options: TestOption[];
};

export function buildQuestionSchema(tx: (key: string) => string) {
  return Yup.object().shape({
    type: Yup.mixed<QuestionType>().oneOf(['single', 'multiple', 'textarea']).required(),
    order: Yup.number()
      .transform((v, o) => (o === '' ? 0 : v))
      .min(0)
      .required(),
    text: Yup.string().trim().required(tx('surveys.questions.validation.textRequired')),
    options: Yup.array()
      .of(
        Yup.object().shape({
          id: Yup.string().required(),
          text: Yup.string().trim().required(tx('surveys.questions.validation.optionText')),
        })
      )
      .when('type', {
        is: (type: QuestionType) => type === 'single' || type === 'multiple',
        then: (s) => s.min(2, tx('surveys.questions.validation.minOptions')),
        otherwise: (s) => s.max(0),
      })
      .required(),
  });
}
