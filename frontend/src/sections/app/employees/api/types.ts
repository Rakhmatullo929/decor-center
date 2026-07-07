/** Matches `EmployeeSerializer` (camelCase). `face_embedding` is never exposed. */
export type Employee = {
  id: number;
  fullName: string;
  specialty: number;
  specialtyName: string;
  /** Employee phone (E.164, e.g. +998901234567) — used for kiosk SMS OTP. */
  phone: string;
  photo: string | null;
  isActive: boolean;
  /** ISO date (YYYY-MM-DD) or null — drives kiosk survey scheduling (Plan 2). */
  hireDate: string | null;
  /** Manually entered years of experience; independent of hireDate. */
  workExperience: number | null;
  createdAt: string;
};

export type EmployeeListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  ordering?: string;
  specialty?: number;
  isActive?: boolean;
};

export type EmployeeUpsertPayload = {
  fullName: string;
  specialty: number;
  phone: string;
  /** New photo file; omit to keep the existing one on edit. */
  photo?: File;
  isActive?: boolean;
  hireDate?: string | null;
  workExperience?: number | null;
};

/** Matches `EmployeeFacePhotoSerializer` (camelCase). `embedding` is never exposed. */
export type FacePhoto = {
  id: number;
  photo: string;
  modelVersion: string;
  createdAt: string;
};
