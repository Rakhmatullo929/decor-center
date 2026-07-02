import * as Yup from 'yup';

export type SpecialtyFormValues = {
  name: string;
  isActive: boolean;
};

export function buildSpecialtySchema(tx: (key: string) => string) {
  return Yup.object().shape({
    name: Yup.string().trim().max(255).required(tx('specialties.validation.nameRequired')),
    isActive: Yup.boolean().required(),
  });
}
