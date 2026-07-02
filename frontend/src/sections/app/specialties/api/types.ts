/** Matches `SpecialtySerializer` (camelCase). */
export type Specialty = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export type SpecialtyListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  ordering?: string;
  isActive?: boolean;
};

export type SpecialtyUpsertPayload = {
  name: string;
  isActive?: boolean;
};
