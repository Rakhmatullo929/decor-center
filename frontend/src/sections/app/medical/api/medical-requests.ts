import { request, API_ENDPOINTS } from 'src/utils/axios';
import type { Pagination } from 'src/hooks/api';

import type {
  MedicalCheck,
  MedicalCheckExportParams,
  MedicalCheckListParams,
  MedicalCheckUpsertPayload,
} from './types';

export function fetchMedicalChecks(params: MedicalCheckListParams) {
  return request<Pagination<MedicalCheck>>({
    method: 'GET',
    url: API_ENDPOINTS.medicalChecks.list,
    params,
  });
}

export function createMedicalCheck(payload: MedicalCheckUpsertPayload) {
  return request<MedicalCheck>({
    method: 'POST',
    url: API_ENDPOINTS.medicalChecks.list,
    data: payload,
  });
}

export function fetchMedicalCheck(id: number | string) {
  return request<MedicalCheck>({
    method: 'GET',
    url: API_ENDPOINTS.medicalChecks.detail(id),
  });
}

/** DELETE is not exposed at all. */
export function updateMedicalCheck(id: number, payload: Partial<MedicalCheckUpsertPayload>) {
  return request<MedicalCheck>({
    method: 'PATCH',
    url: API_ENDPOINTS.medicalChecks.detail(id),
    data: payload,
  });
}

/** XLSX export of the filtered journal (SRS §8.1.6). */
export function exportMedicalChecks(params: MedicalCheckExportParams) {
  return request<Blob>({
    method: 'GET',
    url: API_ENDPOINTS.medicalChecks.export,
    params,
    responseType: 'blob',
  });
}
