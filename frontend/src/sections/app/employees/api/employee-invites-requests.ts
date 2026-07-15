import { request, API_ENDPOINTS } from 'src/utils/axios';

import type {
  CreateInviteResponse,
  RegisterEmployeePayload,
  ValidateInviteResponse,
} from './types';

/** Admin: mint a one-time invite link scoped to a specialty. */
export function createInvite(specialty: number) {
  return request<CreateInviteResponse>({
    method: 'POST',
    url: API_ENDPOINTS.employeeInvites.create,
    data: { specialty },
  });
}

/** Public: check whether an invite token is usable (no auth). */
export function validateInvite(token: string) {
  return request<ValidateInviteResponse>(
    { method: 'GET', url: API_ENDPOINTS.employeeInvites.validate, params: { token } },
    true
  );
}

/** FormData bypasses the camelCase->snake_case transform, so keys are snake_case here. */
export function buildRegisterBody(payload: RegisterEmployeePayload): FormData {
  const formData = new FormData();
  formData.append('token', payload.token);
  formData.append('full_name', payload.fullName);
  formData.append('phone', payload.phone);
  formData.append('work_experience', String(payload.workExperience));
  formData.append('photo', payload.photo);
  return formData;
}

/** Public: submit self-registration (no auth). */
export function registerEmployee(payload: RegisterEmployeePayload) {
  return request<{ status: string }>(
    {
      method: 'POST',
      url: API_ENDPOINTS.employeeInvites.register,
      data: buildRegisterBody(payload),
    },
    true
  );
}
