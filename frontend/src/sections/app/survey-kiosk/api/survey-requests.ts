import { request, API_ENDPOINTS } from 'src/utils/axios';

import type {
  EmployeeLookupItem,
  IdentifyEmployeePayload,
  IdentifyEmployeeResponse,
  RequestOtpResponse,
  StartSurveyPayload,
  StartSurveyResponse,
  SubmitSurveyPayload,
  SurveySession,
  Test,
  VerifyOtpResponse,
} from './types';

/** 1:N face search — public, no session created. */
export function identifyEmployee(payload: IdentifyEmployeePayload) {
  const formData = new FormData();
  formData.append('face_image', payload.faceImage);
  return request<IdentifyEmployeeResponse>(
    { method: 'POST', url: API_ENDPOINTS.surveys.identify, data: formData },
    true
  );
}

/** Send SMS one-time code to the identified employee. Public. */
export function requestOtp(employeeId: number) {
  return request<RequestOtpResponse>(
    { method: 'POST', url: API_ENDPOINTS.surveys.requestOtp, data: { employee: employeeId } },
    true
  );
}

/** Verify the code; logs the employee in for real (access/refresh + user). Public. */
export function verifyOtp(params: { employeeId: number; code: string; fallback: boolean }) {
  return request<VerifyOtpResponse>(
    {
      method: 'POST',
      url: API_ENDPOINTS.surveys.verifyOtp,
      data: { employee: params.employeeId, code: params.code, fallback: params.fallback },
    },
    true
  );
}

/** Manual-fallback name search. Public; needs >=2 chars. */
export function employeesLookup(q: string) {
  return request<EmployeeLookupItem[]>(
    { method: 'GET', url: API_ENDPOINTS.surveys.employeesLookup, params: { q } },
    true
  );
}

/** Surveys currently due — requires the employee JWT from verify-otp (bearer, auto-attached). */
export function fetchDueSurveys(employeeId: number) {
  return request<Test[]>({
    method: 'GET',
    url: API_ENDPOINTS.surveys.due,
    params: { employee: employeeId },
  });
}

/** Start a session — employee JWT gated. face_image omitted on the manual fallback. */
export function startSurvey(payload: StartSurveyPayload) {
  const formData = new FormData();
  formData.append('employee', String(payload.employee));
  formData.append('test', String(payload.test));
  if (payload.faceImage) {
    formData.append('face_image', payload.faceImage);
  }
  return request<StartSurveyResponse>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.start,
    data: formData,
  });
}

/** Persist answers + complete — employee JWT gated. */
export function submitSurvey(sessionId: number, payload: SubmitSurveyPayload) {
  return request<SurveySession>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.submit(sessionId),
    data: payload,
  });
}
