export type InstructionGenerationStatus = 'not_started' | 'completed' | 'failed';

/** Matches `InstructionSerializer` (camelCase). */
export type Instruction = {
  id: number;
  specialty: number;
  specialtyName: string;
  title: string;
  /** Absolute URL of the uploaded source file (pdf/docx/txt/md). */
  file: string;
  generationStatus: InstructionGenerationStatus;
  lastGeneratedAt: string | null;
  createdAt: string;
};

export type InstructionListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  ordering?: string;
  specialty?: number;
  generationStatus?: string;
};

export type InstructionUploadPayload = {
  title: string;
  specialty: number;
  file: File;
};

export type GenerateQuestionsPayload = {
  /** 1-100, backend default is 10. */
  count: number;
};

export type GenerateQuestionsResponse = {
  created: number;
};
