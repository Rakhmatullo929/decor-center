import { useFetch, useMutate } from 'src/hooks/api';

import {
  employeesLookup,
  fetchDueSurveys,
  identifyEmployee,
  requestOtp,
  startSurvey,
  submitSurvey,
  verifyOtp,
} from './survey-requests';
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

export function useDueSurveysQuery(employeeId: number | null, kioskToken: string | null) {
  return useFetch<Test[]>(
    ['kiosk', 'due', employeeId],
    () => fetchDueSurveys(employeeId as number, kioskToken as string),
    { enabled: employeeId !== null && !!kioskToken }
  );
}

export function useStartSurveyMutation() {
  return useMutate<StartSurveyResponse, { payload: StartSurveyPayload; kioskToken: string }>(
    ({ payload, kioskToken }) => startSurvey(payload, kioskToken),
    { skipGlobalErrorNotification: true }
  );
}

export function useSubmitSurveyMutation() {
  return useMutate<
    SurveySession,
    { sessionId: number; payload: SubmitSurveyPayload; kioskToken: string }
  >(({ sessionId, payload, kioskToken }) => submitSurvey(sessionId, payload, kioskToken), {
    skipGlobalErrorNotification: true,
  });
}
