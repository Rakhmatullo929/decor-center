import { keepPreviousData } from '@tanstack/react-query';

import { useFetch } from 'src/hooks/api';

import { fetchDashboardStats } from './dashboard-requests';
import type { DashboardStatsParams } from './types';

export function useDashboardStatsQuery(params: DashboardStatsParams) {
  return useFetch(['dashboard', 'stats', params], () => fetchDashboardStats(params), {
    placeholderData: keepPreviousData,
  });
}
