import * as Yup from 'yup';

export const GENERATE_COUNT_MIN = 1;
export const GENERATE_COUNT_MAX = 100;
export const GENERATE_COUNT_DEFAULT = 10;

export type GenerateQuestionsFormValues = {
  count: number;
};

export function buildGenerateQuestionsSchema(
  tx: (key: string, options?: Record<string, string | number>) => string
) {
  return Yup.object().shape({
    count: Yup.number()
      .typeError(tx('common.validation.integer'))
      .integer(tx('common.validation.integer'))
      .min(GENERATE_COUNT_MIN, tx('common.validation.minValue', { min: GENERATE_COUNT_MIN }))
      .max(GENERATE_COUNT_MAX, tx('common.validation.maxValue', { max: GENERATE_COUNT_MAX }))
      .required(tx('instructions.validation.countRequired')),
  });
}
