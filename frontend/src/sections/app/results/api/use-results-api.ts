import { keepPreviousData } from '@tanstack/react-query';

import { useFetch, useFetchList, useFetchOne, useMutate } from 'src/hooks/api';

import { fetchEmployees } from '../../employees/api/employees-requests';
import {
  exportTestSessions,
  fetchEmployeeById,
  fetchTestSession,
  fetchTestSessions,
} from './results-requests';
import type { ResultExportParams, ResultListParams, TestSessionDetail, TestSessionRow } from './types';

export function useResultsQuery(params: ResultListParams) {
  return useFetchList<TestSessionRow>(['results', 'list', params], () => fetchTestSessions(params), {
    placeholderData: keepPreviousData,
  });
}

export function useResultDetailQuery(id: string | undefined) {
  return useFetchOne<TestSessionDetail>(
    ['results', 'detail', id],
    () => fetchTestSession(id as string),
    { enabled: Boolean(id) }
  );
}

/** Server-side employee search for the toolbar Autocomplete filter. */
export function useEmployeeFilterOptionsQuery(search: string) {
  return useFetch(
    ['results', 'employeeOptions', search],
    () =>
      fetchEmployees({
        pageSize: 20,
        ordering: 'full_name',
        isActive: true,
        ...(search ? { search } : {}),
      }),
    { placeholderData: keepPreviousData }
  );
}

/** Resolves the selected employee's name when only the id is known (from the URL). */
export function useEmployeeFilterValueQuery(id: number | null) {
  return useFetch(
    ['results', 'employeeOption', id],
    () => fetchEmployeeById(id as number),
    { enabled: id !== null }
  );
}

/** XLSX download of the currently filtered results. */
export function useExportResultsMutation() {
  return useMutate<Blob, ResultExportParams>((params) => exportTestSessions(params));
}
