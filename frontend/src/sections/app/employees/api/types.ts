/** Matches `EmployeeSerializer` (camelCase). `face_embedding` is never exposed. */
export type Employee = {
  id: number;
  fullName: string;
  specialty: number;
  specialtyName: string;
  photo: string | null;
  isActive: boolean;
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
  /** New photo file; omit to keep the existing one on edit. */
  photo?: File;
  isActive?: boolean;
};

/** Matches `EmployeeFacePhotoSerializer` (camelCase). `embedding` is never exposed. */
export type FacePhoto = {
  id: number;
  photo: string;
  modelVersion: string;
  createdAt: string;
};
