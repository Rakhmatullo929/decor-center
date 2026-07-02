export type MedicalConclusion = 'approved' | 'rejected';

/** Matches `MedicalCheckSerializer` (camelCase). DRF decimals arrive as strings. */
export type MedicalCheck = {
  id: number;
  employee: number;
  employeeName: string;
  bpSystolic: number;
  bpDiastolic: number;
  pulse: number;
  saturation: number;
  alcoholValue: string | null;
  alcoholPositive: boolean;
  hoursWorked: string;
  hoursRested: string;
  conclusion: MedicalConclusion;
  note: string;
  medic: number;
  medicUsername: string;
  createdAt: string;
};

export type MedicalCheckListParams = {
  page?: number;
  pageSize?: number;
  ordering?: string;
  employee?: number;
  conclusion?: MedicalConclusion;
  /** YYYY-MM-DD; filters sessions that started on exactly this day. */
  date?: string;
};

/** XLSX export takes the same filters, without pagination (SRS §8.1.6). */
export type MedicalCheckExportParams = Omit<MedicalCheckListParams, 'page' | 'pageSize'>;

/** `medic` and `createdAt` are set server-side (SRS §7.1-7.2). */
export type MedicalCheckUpsertPayload = {
  employee: number;
  bpSystolic: number;
  bpDiastolic: number;
  pulse: number;
  saturation: number;
  /** Decimal sent as string for DRF; `null` — not measured. */
  alcoholValue: string | null;
  alcoholPositive: boolean;
  hoursWorked: string;
  hoursRested: string;
  conclusion: MedicalConclusion;
  note: string;
};
