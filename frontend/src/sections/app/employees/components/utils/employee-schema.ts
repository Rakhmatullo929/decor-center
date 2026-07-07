import * as Yup from 'yup';

export type EmployeeFormValues = {
  fullName: string;
  specialty: number | '';
  /** Phone (E.164, e.g. +998901234567) — used for kiosk SMS OTP. */
  phone: string;
  /** `File` for a new upload, `string` URL for the existing photo on edit. */
  photo: File | string | null;
  isActive: boolean;
  /** '' when unset; sent as null to the API. */
  hireDate: string;
  /** '' when unset; coerced to null. */
  workExperience: number | '' | null;
};

export function buildEmployeeSchema(tx: (key: string) => string) {
  return Yup.object().shape({
    fullName: Yup.string().trim().max(255).required(tx('employees.validation.fullNameRequired')),
    specialty: Yup.number()
      .typeError(tx('employees.validation.specialtyRequired'))
      .required(tx('employees.validation.specialtyRequired')),
    phone: Yup.string()
      .trim()
      .required(tx('employees.validation.phoneRequired'))
      .matches(/^\+\d{9,15}$/, {
        message: tx('employees.validation.phoneInvalid'),
        excludeEmptyString: true,
      }),
    photo: Yup.mixed<File | string>()
      .nullable()
      .test('photo-required', tx('employees.validation.photoRequired'), (value) => Boolean(value)),
    isActive: Yup.boolean().required(),
    hireDate: Yup.string().ensure(),
    workExperience: Yup.number()
      .transform((value, original) => (original === '' || original === null ? null : value))
      .nullable()
      .min(0, tx('employees.validation.workExperienceMin')),
  });
}
