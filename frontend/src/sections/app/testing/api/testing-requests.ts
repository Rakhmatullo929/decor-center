import { request, API_ENDPOINTS } from 'src/utils/axios';

import type {
  IdentifyEmployeePayload,
  IdentifyEmployeeResponse,
  StartTestSessionPayload,
  StartTestSessionResponse,
  SubmitTestSessionPayload,
  TestSession,
} from './types';

/** Identify an employee from a live camera frame — no session is created. */
export function identifyEmployee(payload: IdentifyEmployeePayload) {
  const formData = new FormData();
  formData.append('face_image', payload.faceImage);

  return request<IdentifyEmployeeResponse>({
    method: 'POST',
    url: API_ENDPOINTS.testSessions.identify,
    data: formData,
  });
}

/**
 * Face ID gate + session creation (SRS §5.2). Requires multipart, and FormData
 * bypasses the camelCase→snake_case transform in `apiClient`, so keys are
 * appended in backend (snake_case) form here.
 */
export function startTestSession(payload: StartTestSessionPayload) {
  const formData = new FormData();
  formData.append('employee', String(payload.employee));
  formData.append('module', payload.module);
  formData.append('face_image', payload.faceImage);

  return request<StartTestSessionResponse>({
    method: 'POST',
    url: API_ENDPOINTS.testSessions.start,
    data: formData,
  });
}

/** Submit answers for exactly the presented questions (SRS §5.2.8). */
export function submitTestSession(sessionId: number, payload: SubmitTestSessionPayload) {
  return request<TestSession>({
    method: 'POST',
    url: API_ENDPOINTS.testSessions.submit(sessionId),
    data: payload,
  });
}
