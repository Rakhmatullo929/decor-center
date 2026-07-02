import { keepPreviousData } from '@tanstack/react-query';

import { useFetch, useFetchList, useMutate } from 'src/hooks/api';

import { createEmployee, fetchEmployee, fetchEmployees, updateEmployee } from './employees-requests';
import type { Employee, EmployeeListParams, EmployeeUpsertPayload } from './types';

export function useEmployeesQuery(params: EmployeeListParams) {
  return useFetchList<Employee>(['employees', 'list', params], () => fetchEmployees(params), {
    placeholderData: keepPreviousData,
  });
}

export function useEmployeeQuery(id: number | string) {
  return useFetch<Employee>(['employees', 'detail', id], () => fetchEmployee(id));
}

export function useCreateEmployeeMutation() {
  return useMutate<Employee, EmployeeUpsertPayload>((payload) => createEmployee(payload), {
    // Photo validation errors ("no face detected") are rendered inside the form.
    skipGlobalErrorNotification: true,
  });
}

export function useUpdateEmployeeMutation() {
  return useMutate<Employee, { id: number; payload: Partial<EmployeeUpsertPayload> }>(
    ({ id, payload }) => updateEmployee(id, payload),
    {
      skipGlobalErrorNotification: true,
    }
  );
}

/** Archive / activate from the list — global error toast is fine here. */
export function useToggleEmployeeActiveMutation() {
  return useMutate<Employee, { id: number; isActive: boolean }>(({ id, isActive }) =>
    updateEmployee(id, { isActive })
  );
}
