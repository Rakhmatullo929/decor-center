import { keepPreviousData } from '@tanstack/react-query';

import { useFetch, useFetchList, useFetchOne, useMutate } from 'src/hooks/api';
import { fetchEmployees } from '../../employees/api/employees-requests';
import { fetchEmployeeById } from '../../results/api/results-requests';

import {
  createMedicalCheck,
  exportMedicalChecks,
  fetchMedicalCheck,
  fetchMedicalChecks,
  updateMedicalCheck,
} from './medical-requests';
import type {
  MedicalCheck,
  MedicalCheckExportParams,
  MedicalCheckListParams,
  MedicalCheckUpsertPayload,
} from './types';

export function useMedicalCheckQuery(id: string | undefined) {
  return useFetchOne<MedicalCheck>(
    ['medical-checks', 'detail', id],
    () => fetchMedicalCheck(id as string),
    { enabled: Boolean(id) }
  );
}

export function useMedicalChecksQuery(params: MedicalCheckListParams) {
  return useFetchList<MedicalCheck>(
    ['medical-checks', 'list', params],
    () => fetchMedicalChecks(params),
    { placeholderData: keepPreviousData }
  );
}

export function useCreateMedicalCheckMutation() {
  return useMutate<MedicalCheck, MedicalCheckUpsertPayload>((payload) => createMedicalCheck(payload), {
    // Backend range validation errors are rendered inside the form alert.
    skipGlobalErrorNotification: true,
  });
}

export function useUpdateMedicalCheckMutation() {
  return useMutate<MedicalCheck, { id: number; payload: Partial<MedicalCheckUpsertPayload> }>(
    ({ id, payload }) => updateMedicalCheck(id, payload),
    {
      skipGlobalErrorNotification: true,
    }
  );
}

/** XLSX download of the currently filtered journal. */
export function useExportMedicalChecksMutation() {
  return useMutate<Blob, MedicalCheckExportParams>((params) => exportMedicalChecks(params));
}

/** Server-side employee search for the toolbar Autocomplete filter. */
export function useMedicalEmployeeOptionsQuery(search: string) {
  return useFetch(
    ['medical-checks', 'employeeOptions', search],
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
export function useMedicalEmployeeValueQuery(id: number | null) {
  return useFetch(
    ['medical-checks', 'employeeOption', id],
    () => fetchEmployeeById(id as number),
    { enabled: id !== null }
  );
}
