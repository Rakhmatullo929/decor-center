import { request } from 'src/utils/axios';

import { AUTH_URLS } from './urls';
import type { DecorUser, LoginRequest, TokenPairResponse } from './types';

export async function fetchLogin(data: LoginRequest): Promise<TokenPairResponse> {
  return request<TokenPairResponse>(
    {
      method: 'POST',
      url: AUTH_URLS.login,
      data,
    },
    true
  );
}

export async function fetchLogout(refresh: string): Promise<void> {
  await request<void>({
    method: 'POST',
    url: AUTH_URLS.logout,
    data: { refresh },
  });
}

export async function fetchCurrentUser(): Promise<DecorUser> {
  return request<DecorUser>({
    method: 'GET',
    url: AUTH_URLS.me,
  });
}
