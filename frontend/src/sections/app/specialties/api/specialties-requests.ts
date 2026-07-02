import { request, API_ENDPOINTS } from 'src/utils/axios';
import type { Pagination } from 'src/hooks/api';

import type { Specialty, SpecialtyListParams, SpecialtyUpsertPayload } from './types';

export function fetchSpecialties(params: SpecialtyListParams) {
  return request<Pagination<Specialty>>({
    method: 'GET',
    url: API_ENDPOINTS.specialties.list,
    params,
  });
}

export function createSpecialty(payload: SpecialtyUpsertPayload) {
  return request<Specialty>({
    method: 'POST',
    url: API_ENDPOINTS.specialties.list,
    data: payload,
  });
}

export function updateSpecialty(id: number, payload: Partial<SpecialtyUpsertPayload>) {
  return request<Specialty>({
    method: 'PATCH',
    url: API_ENDPOINTS.specialties.detail(id),
    data: payload,
  });
}

export function deleteSpecialty(id: number) {
  return request<void>({
    method: 'DELETE',
    url: API_ENDPOINTS.specialties.detail(id),
  });
}
