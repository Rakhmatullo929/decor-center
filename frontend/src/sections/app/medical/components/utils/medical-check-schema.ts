import * as Yup from 'yup';

import type { MedicalConclusion } from '../../api/types';

/** Minimal employee shape needed by the autocomplete (subset of `Employee`). */
export type EmployeeOption = {
  id: number;
  fullName: string;
};

/**
 * Numeric inputs use `RHFTextField type="number"`, which renders `0` as an
 * empty input — so `0` doubles as the "empty" default for the vitals
 * (their minimums are above zero, validation catches the blank field).
 */
export type MedicalCheckFormValues = {
  employee: EmployeeOption | null;
  bpSystolic: number;
  bpDiastolic: number;
  pulse: number;
  saturation: number;
  alcoholValue: number;
  alcoholPositive: boolean;
  hoursWorked: number;
  hoursRested: number;
  conclusion: MedicalConclusion;
  note: string;
};

type Tx = (key: string, options?: Record<string, string | number>) => string;

/** Fields shared between create and edit pages (no employee — already selected). */
export type MedicalCheckFieldsValues = Omit<MedicalCheckFormValues, 'employee'>;

function buildVitalsShape(tx: Tx) {
  const intInRange = (min: number, max: number) =>
    Yup.number()
      .typeError(tx('common.validation.integer'))
      .integer(tx('common.validation.integer'))
      .min(min, tx('common.validation.minValue', { min }))
      .max(max, tx('common.validation.maxValue', { max }))
      .required(tx('common.validation.required'));

  const decimalInRange = (min: number, max: number) =>
    Yup.number()
      .typeError(tx('medical.validation.number'))
      .min(min, tx('common.validation.minValue', { min }))
      .max(max, tx('common.validation.maxValue', { max }))
      .required(tx('common.validation.required'));

  return {
    bpSystolic: intInRange(40, 300),
    bpDiastolic: intInRange(20, 200),
    pulse: intInRange(20, 250),
    saturation: intInRange(50, 100),
    alcoholValue: decimalInRange(0, 99.999),
    alcoholPositive: Yup.boolean().required(),
    hoursWorked: decimalInRange(0, 24),
    hoursRested: decimalInRange(0, 168),
    conclusion: Yup.mixed<MedicalConclusion>()
      .oneOf(['approved', 'rejected'])
      .required(tx('common.validation.selectRequired')),
    note: Yup.string().defined(),
  };
}

/** Schema for the full dialog form (with employee autocomplete). */
export function buildMedicalCheckSchema(tx: Tx) {
  return Yup.object().shape({
    employee: Yup.mixed<EmployeeOption>()
      .nullable()
      .test('employee-required', tx('common.validation.selectRequired'), (value) => Boolean(value)),
    ...buildVitalsShape(tx),
  });
}

/** Schema for the create/edit page forms (employee pre-selected from URL). */
export function buildMedicalCheckFieldsSchema(tx: Tx) {
  return Yup.object().shape(buildVitalsShape(tx));
}
