import { keepPreviousData } from '@tanstack/react-query';

import { useFetch, useMutate } from 'src/hooks/api';

import { fetchEmployees } from '../../employees/api/employees-requests';
import type { EmployeeListParams } from '../../employees/api/types';
import { identifyEmployee, startTestSession, submitTestSession } from './testing-requests';
import type {
  IdentifyEmployeePayload,
  IdentifyEmployeeResponse,
  StartTestSessionPayload,
  StartTestSessionResponse,
  SubmitTestSessionPayload,
  TestSession,
} from './types';

/** Kiosk employee picker — active employees only, searched by full name (SRS §5.2.2). */
export function useTestingEmployeesQuery(params: EmployeeListParams) {
  return useFetch(['testing', 'employees', params], () => fetchEmployees(params), {
    placeholderData: keepPreviousData,
  });
}

/** Identify an employee by face — errors are rendered inline, not globally. */
export function useIdentifyEmployeeMutation() {
  return useMutate<IdentifyEmployeeResponse, IdentifyEmployeePayload>(
    (payload) => identifyEmployee(payload),
    { skipGlobalErrorNotification: true }
  );
}

export function useStartTestSessionMutation() {
  return useMutate<StartTestSessionResponse, StartTestSessionPayload>(
    (payload) => startTestSession(payload),
    {
      // Face ID (403) and question-bank (400) errors are rendered inside the wizard step.
      skipGlobalErrorNotification: true,
    }
  );
}

export function useSubmitTestSessionMutation() {
  return useMutate<TestSession, { sessionId: number; payload: SubmitTestSessionPayload }>(
    ({ sessionId, payload }) => submitTestSession(sessionId, payload),
    {
      // Re-verify (403) and flow (400) errors are surfaced inside the questions view.
      skipGlobalErrorNotification: true,
    }
  );
}
