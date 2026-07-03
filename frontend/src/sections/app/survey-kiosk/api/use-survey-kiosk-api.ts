import { keepPreviousData } from '@tanstack/react-query';

import { useFetch, useMutate } from 'src/hooks/api';

import { fetchEmployees } from '../../employees/api/employees-requests';
import type { EmployeeListParams } from '../../employees/api/types';
import { fetchDueSurveys, identifyEmployee, startSurvey, submitSurvey } from './survey-requests';
import type {
  IdentifyEmployeePayload,
  IdentifyEmployeeResponse,
  StartSurveyPayload,
  StartSurveyResponse,
  SubmitSurveyPayload,
  SurveySession,
  Test,
} from './types';

export function useKioskEmployeesQuery(params: EmployeeListParams) {
  return useFetch(['kiosk', 'employees', params], () => fetchEmployees(params), {
    placeholderData: keepPreviousData,
  });
}

export function useIdentifyEmployeeMutation() {
  return useMutate<IdentifyEmployeeResponse, IdentifyEmployeePayload>(
    (payload) => identifyEmployee(payload),
    { skipGlobalErrorNotification: true }
  );
}

export function useDueSurveysQuery(employeeId: number | null) {
  return useFetch<Test[]>(['kiosk', 'due', employeeId], () => fetchDueSurveys(employeeId as number), {
    enabled: employeeId !== null,
  });
}

export function useStartSurveyMutation() {
  return useMutate<StartSurveyResponse, StartSurveyPayload>((payload) => startSurvey(payload), {
    skipGlobalErrorNotification: true,
  });
}

export function useSubmitSurveyMutation() {
  return useMutate<SurveySession, { sessionId: number; payload: SubmitSurveyPayload }>(
    ({ sessionId, payload }) => submitSurvey(sessionId, payload),
    { skipGlobalErrorNotification: true }
  );
}
