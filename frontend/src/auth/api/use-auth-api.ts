import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthContext } from 'src/auth/hooks/use-auth-context';
import { useMutate } from 'src/hooks/api';

import { fetchLogin } from './auth-requests';
import { buildMockAuthUser, createMockAccessToken, isJwtAuthMock } from '../context/jwt/mock-auth';
import type { LoginRequest, TokenPairResponse } from './types';

// ----------------------------------------------------------------------

export function useLoginMutation(rememberMe: boolean) {
  const { syncSessionFromApiResponse } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutate<TokenPairResponse, LoginRequest>(
    async (data) => {
      if (isJwtAuthMock()) {
        const access = createMockAccessToken();
        const user = buildMockAuthUser(data.username);
        return { access, refresh: '', user };
      }
      return fetchLogin(data);
    },
    {
      skipGlobalErrorNotification: true,
      onSuccess: (payload) => {
        syncSessionFromApiResponse(payload, rememberMe);
        queryClient.invalidateQueries();
      },
    }
  );
}

export function useLogoutMutation() {
  const { logout } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
