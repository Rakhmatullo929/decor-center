import { keepPreviousData } from '@tanstack/react-query';

import { useFetch, useFetchList, useMutate } from 'src/hooks/api';

import { createSpecialty, deleteSpecialty, fetchSpecialties, updateSpecialty } from './specialties-requests';
import type { Specialty, SpecialtyListParams, SpecialtyUpsertPayload } from './types';

export function useSpecialtiesQuery(params: SpecialtyListParams) {
  return useFetchList<Specialty>(['specialties', 'list', params], () => fetchSpecialties(params), {
    placeholderData: keepPreviousData,
  });
}

/** Active specialties for selects (employee form, question form, filters). */
export function useSpecialtyOptionsQuery() {
  return useFetch(['specialties', 'options'], () =>
    fetchSpecialties({ pageSize: 100, isActive: true, ordering: 'name' })
  );
}

export function useCreateSpecialtyMutation() {
  return useMutate<Specialty, SpecialtyUpsertPayload>((payload) => createSpecialty(payload));
}

export function useUpdateSpecialtyMutation() {
  return useMutate<Specialty, { id: number; payload: Partial<SpecialtyUpsertPayload> }>(
    ({ id, payload }) => updateSpecialty(id, payload)
  );
}

export function useDeleteSpecialtyMutation() {
  return useMutate<void, number>((id) => deleteSpecialty(id));
}
