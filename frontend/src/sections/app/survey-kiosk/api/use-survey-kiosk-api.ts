import { useFetch, useMutate } from 'src/hooks/api';

import {
  autosaveAnswer,
  employeesLookup,
  fetchDueSurveys,
  fetchInProgressSessions,
  fetchSessionDetail,
  identifyEmployee,
  requestOtp,
  startSurvey,
  submitSurvey,
  verifyOtp,
} from './survey-requests';
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

export function useIdentifyEmployeeMutation() {
  return useMutate<IdentifyEmployeeResponse, IdentifyEmployeePayload>(
    (payload) => identifyEmployee(payload),
    { skipGlobalErrorNotification: true }
  );
}

export function useRequestOtpMutation() {
  return useMutate<RequestOtpResponse, number>((employeeId) => requestOtp(employeeId), {
    skipGlobalErrorNotification: true,
  });
}

export function useVerifyOtpMutation() {
  return useMutate<VerifyOtpResponse, { employeeId: number; code: string; fallback: boolean }>(
    (params) => verifyOtp(params),
    { skipGlobalErrorNotification: true }
  );
}

export function useEmployeesLookupQuery(q: string) {
  return useFetch<EmployeeLookupItem[]>(['kiosk', 'lookup', q], () => employeesLookup(q), {
    enabled: q.trim().length >= 2,
  });
}

export function useDueSurveysQuery(employeeId: number | null, verified: boolean) {
  return useFetch<Test[]>(
    ['kiosk', 'due', employeeId],
    () => fetchDueSurveys(employeeId as number),
    { enabled: employeeId !== null && verified }
  );
}

export function useStartSurveyMutation() {
  return useMutate<StartSurveyResponse, { payload: StartSurveyPayload }>(
    ({ payload }) => startSurvey(payload),
    { skipGlobalErrorNotification: true }
  );
}

/** The employee's own unfinished sessions — powers the cabinet's "continue" section. */
export function useInProgressSessionsQuery(employeeId: number | null) {
  return useFetch<SurveySession[]>(
    ['kiosk', 'in-progress', employeeId],
    () => fetchInProgressSessions(employeeId as number),
    { enabled: employeeId !== null }
  );
}

/** Full state for `/survey/:sessionId` — loads from the backend, not just local state. */
export function useSessionDetailQuery(sessionId: number | string | undefined) {
  return useFetch<SurveySessionDetail>(
    ['kiosk', 'session', sessionId],
    () => fetchSessionDetail(sessionId as number | string),
    { enabled: sessionId !== undefined, retry: false }
  );
}

export function useAutosaveAnswerMutation() {
  return useMutate<
    SurveyAnswer,
    { sessionId: number | string; item: AutosaveAnswerPayload }
  >(({ sessionId, item }) => autosaveAnswer(sessionId, item), {
    skipGlobalErrorNotification: true,
  });
}

export function useSubmitSurveyMutation() {
  return useMutate<SurveySession, { sessionId: number; payload: SubmitSurveyPayload }>(
    ({ sessionId, payload }) => submitSurvey(sessionId, payload),
    { skipGlobalErrorNotification: true }
  );
}
