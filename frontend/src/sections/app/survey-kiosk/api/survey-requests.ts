import { request, API_ENDPOINTS } from 'src/utils/axios';

import type {
  IdentifyEmployeePayload,
  IdentifyEmployeeResponse,
  StartSurveyPayload,
  StartSurveyResponse,
  SubmitSurveyPayload,
  SurveySession,
  Test,
} from './types';

/** 1:N face search — no session created. Multipart bypasses camelCase transform. */
export function identifyEmployee(payload: IdentifyEmployeePayload) {
  const formData = new FormData();
  formData.append('face_image', payload.faceImage);
  return request<IdentifyEmployeeResponse>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.identify,
    data: formData,
  });
}

/** Surveys currently due for an employee (spec §4.2). */
export function fetchDueSurveys(employeeId: number) {
  return request<Test[]>({
    method: 'GET',
    url: API_ENDPOINTS.surveys.due,
    params: { employee: employeeId },
  });
}

/** Face-ID gate + session creation; returns the frozen block/question set. */
export function startSurvey(payload: StartSurveyPayload) {
  const formData = new FormData();
  formData.append('employee', String(payload.employee));
  formData.append('test', String(payload.test));
  formData.append('face_image', payload.faceImage);
  return request<StartSurveyResponse>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.start,
    data: formData,
  });
}

/** Persist answers + set completed_at. JSON body (camelCase → snake_case by client). */
export function submitSurvey(sessionId: number, payload: SubmitSurveyPayload) {
  return request<SurveySession>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.submit(sessionId),
    data: payload,
  });
}
