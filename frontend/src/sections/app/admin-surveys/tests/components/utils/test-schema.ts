import * as Yup from 'yup';

export type TestFormValues = {
  title: string;
  isActive: boolean;
  isAdminConducted: boolean;
  isAfterApplication: boolean;
  afterDays: number | null;
  testDaysFrom: number | null;
  testDaysTo: number | null;
  /** Months as strings for RHFMultiSelect; converted to number[] on submit. */
  month: string[];
};

const nullableInt = () =>
  Yup.number()
    .transform((value, original) => (original === '' || original === null ? null : value))
    .nullable();

export function buildTestSchema(tx: (key: string) => string) {
  return Yup.object().shape({
    title: Yup.string().trim().max(255).required(tx('surveys.tests.validation.titleRequired')),
    isActive: Yup.boolean().required(),
    isAdminConducted: Yup.boolean().required(),
    isAfterApplication: Yup.boolean().required(),
    afterDays: nullableInt()
      .min(0, tx('surveys.tests.validation.afterDaysMin'))
      .when('isAfterApplication', {
        is: true,
        then: (s) => s.required(tx('surveys.tests.validation.afterDaysRequired')),
      }),
    testDaysFrom: nullableInt().min(1).max(31),
    testDaysTo: nullableInt()
      .min(1)
      .max(31)
      .test('day-range', tx('surveys.tests.validation.dayRange'), function validRange(to) {
        const { testDaysFrom, isAfterApplication } = this.parent as TestFormValues;
        if (isAfterApplication) return true;
        if (to == null || testDaysFrom == null) return true;
        return to >= testDaysFrom;
      }),
    month: Yup.array().of(Yup.number().required()).required(),
  });
}
