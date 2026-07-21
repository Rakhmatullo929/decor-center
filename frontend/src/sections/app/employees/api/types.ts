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
  /** True iff this employee self-registered via an invite link (drives the "pending" chip). */
  isSelfRegistered?: boolean;
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

export type CreateInviteResponse = {
  token: string;
  /** ISO datetime the link expires. */
  expiresAt: string;
};

export type InviteInvalidReason = 'ok' | 'used' | 'expired' | 'not_found';

export type ValidateInviteResponse = {
  valid: boolean;
  reason: InviteInvalidReason;
  specialtyName?: string;
};

export type RegisterEmployeePayload = {
  token: string;
  fullName: string;
  phone: string;
  workExperience: number;
  photo: File;
};
