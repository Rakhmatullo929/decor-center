import { request, API_ENDPOINTS } from 'src/utils/axios';
import type { Pagination } from 'src/hooks/api';

import type { Employee, EmployeeListParams, EmployeeUpsertPayload } from './types';

/**
 * Photo upload requires multipart. FormData bypasses the snake_case transform
 * in `apiClient`, so keys are appended in backend (snake_case) form here.
 */
export function buildEmployeeBody(payload: Partial<EmployeeUpsertPayload>): FormData | object {
  if (!payload.photo) {
    const { fullName, specialty, isActive, hireDate, workExperience } = payload;
    return {
      ...(fullName !== undefined ? { fullName } : {}),
      ...(specialty !== undefined ? { specialty } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(hireDate !== undefined ? { hireDate } : {}),
      ...(workExperience !== undefined ? { workExperience } : {}),
    };
  }

  const formData = new FormData();
  if (payload.fullName !== undefined) formData.append('full_name', payload.fullName);
  if (payload.specialty !== undefined) formData.append('specialty', String(payload.specialty));
  if (payload.isActive !== undefined) formData.append('is_active', String(payload.isActive));
  if (payload.hireDate !== undefined && payload.hireDate !== null)
    formData.append('hire_date', payload.hireDate);
  if (payload.workExperience !== undefined && payload.workExperience !== null)
    formData.append('work_experience', String(payload.workExperience));
  formData.append('photo', payload.photo);
  return formData;
}

export function fetchEmployees(params: EmployeeListParams) {
  return request<Pagination<Employee>>({
    method: 'GET',
    url: API_ENDPOINTS.employees.list,
    params,
  });
}

export function fetchEmployee(id: number | string) {
  return request<Employee>({
    method: 'GET',
    url: API_ENDPOINTS.employees.detail(id),
  });
}

export function createEmployee(payload: EmployeeUpsertPayload) {
  return request<Employee>({
    method: 'POST',
    url: API_ENDPOINTS.employees.list,
    data: buildEmployeeBody(payload),
  });
}

export function updateEmployee(id: number, payload: Partial<EmployeeUpsertPayload>) {
  return request<Employee>({
    method: 'PATCH',
    url: API_ENDPOINTS.employees.detail(id),
    data: buildEmployeeBody(payload),
  });
}
