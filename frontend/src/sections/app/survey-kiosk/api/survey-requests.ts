import { request, API_ENDPOINTS } from 'src/utils/axios';

import type {
  AutosaveAnswerPayload,
  EmployeeLookupItem,
  IdentifyEmployeePayload,
  IdentifyEmployeeResponse,
  RequestOtpResponse,
  StartSurveyPayload,
  StartSurveyResponse,
  SubmitSurveyPayload,
  SurveyAnswer,
  SurveySession,
  SurveySessionDetail,
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

/** Start (or resume) a session — employee JWT gated. Face-ID was already verified once
 * at kiosk entry, so no camera frame is sent here. */
export function startSurvey(payload: StartSurveyPayload) {
  return request<StartSurveyResponse>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.start,
    data: { employee: payload.employee, test: payload.test },
  });
}

/** The employee's own unfinished sessions — powers the cabinet's "continue" list. */
export function fetchInProgressSessions(employeeId: number) {
  return request<SurveySession[]>({
    method: 'GET',
    url: API_ENDPOINTS.surveys.inProgress,
    params: { employee: employeeId },
  });
}

/** Full state for resuming `/survey/:sessionId` — blocks + already-saved answers. */
export function fetchSessionDetail(sessionId: number | string) {
  return request<SurveySessionDetail>({
    method: 'GET',
    url: API_ENDPOINTS.surveys.session(sessionId),
  });
}

/** Autosave one answer as the employee fills in the form — does not complete the session. */
export function autosaveAnswer(sessionId: number | string, item: AutosaveAnswerPayload) {
  return request<SurveyAnswer>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.answer(sessionId),
    data: item,
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
