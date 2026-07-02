import { request, API_ENDPOINTS } from 'src/utils/axios';
import type { Pagination } from 'src/hooks/api';

import type { Employee } from '../../employees/api/types';
import type { ResultExportParams, ResultListParams, TestSessionDetail, TestSessionRow } from './types';

export function fetchTestSessions(params: ResultListParams) {
  return request<Pagination<TestSessionRow>>({
    method: 'GET',
    url: API_ENDPOINTS.testSessions.list,
    params,
  });
}

export function fetchTestSession(id: number | string) {
  return request<TestSessionDetail>({
    method: 'GET',
    url: API_ENDPOINTS.testSessions.detail(id),
  });
}

/** Resolves the employee-filter label when the id arrives via a shared/bookmarked URL. */
export function fetchEmployeeById(id: number | string) {
  return request<Employee>({
    method: 'GET',
    url: API_ENDPOINTS.employees.detail(id),
  });
}

/** XLSX export of the filtered results (SRS §8.1.6). */
export function exportTestSessions(params: ResultExportParams) {
  return request<Blob>({
    method: 'GET',
    url: API_ENDPOINTS.testSessions.export,
    params,
    responseType: 'blob',
  });
}
