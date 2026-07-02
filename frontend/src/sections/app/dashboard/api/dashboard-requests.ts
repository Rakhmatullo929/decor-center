import { request, API_ENDPOINTS } from 'src/utils/axios';

import type { DashboardStats, DashboardStatsParams } from './types';

export function fetchDashboardStats(params: DashboardStatsParams) {
  return request<DashboardStats>({
    method: 'GET',
    url: API_ENDPOINTS.dashboard.stats,
    params,
  });
}
