import { useMutate } from 'src/hooks/api';

import { createInvite, registerEmployee } from './employee-invites-requests';
import type { CreateInviteResponse, RegisterEmployeePayload } from './types';

export function useCreateInviteMutation() {
  return useMutate<CreateInviteResponse, number>((specialty) => createInvite(specialty));
}

/** Face/validation errors are also rendered inline in the registration form. */
export function useRegisterEmployeeMutation() {
  return useMutate<{ status: string }, RegisterEmployeePayload>((payload) =>
    registerEmployee(payload)
  );
}
