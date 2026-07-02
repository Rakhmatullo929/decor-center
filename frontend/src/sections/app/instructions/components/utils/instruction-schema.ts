import * as Yup from 'yup';

export type InstructionFormValues = {
  title: string;
  specialty: number | '';
  /** New source document; backend accepts pdf/docx/txt/md only. */
  file: File | null;
};

export function buildInstructionSchema(tx: (key: string) => string) {
  return Yup.object().shape({
    title: Yup.string().trim().max(255).required(tx('instructions.validation.titleRequired')),
    specialty: Yup.number()
      .typeError(tx('instructions.validation.specialtyRequired'))
      .required(tx('instructions.validation.specialtyRequired')),
    file: Yup.mixed<File>()
      .nullable()
      .test('file-required', tx('instructions.validation.fileRequired'), (value) => Boolean(value)),
  });
}
