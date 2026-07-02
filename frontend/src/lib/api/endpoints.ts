const API_V1 = '/api/v1';

/**
 * Pathnames from the app origin (`baseURL` = `HOST_API`).
 * Django: `backend/config/api_v1.py` → `/api/v1/...`
 */
export const API_ENDPOINTS = {
  auth: {
    login: `${API_V1}/auth/login/`,
    refresh: `${API_V1}/auth/refresh/`,
    logout: `${API_V1}/auth/logout/`,
    me: `${API_V1}/auth/me/`,
  },
  specialties: {
    list: `${API_V1}/specialties/`,
    detail: (id: number | string) => `${API_V1}/specialties/${id}/`,
  },
  employees: {
    list: `${API_V1}/employees/`,
    detail: (id: number | string) => `${API_V1}/employees/${id}/`,
    facePhotos: (id: number | string) => `${API_V1}/employees/${id}/face-photos/`,
    facePhoto: (id: number | string, photoId: number | string) =>
      `${API_V1}/employees/${id}/face-photos/${photoId}/`,
  },
  instructions: {
    list: `${API_V1}/instructions/`,
    detail: (id: number | string) => `${API_V1}/instructions/${id}/`,
    generate: (id: number | string) => `${API_V1}/instructions/${id}/generate/`,
  },
  questions: {
    list: `${API_V1}/questions/`,
    detail: (id: number | string) => `${API_V1}/questions/${id}/`,
    approve: (id: number | string) => `${API_V1}/questions/${id}/approve/`,
  },
  testSessions: {
    list: `${API_V1}/test-sessions/`,
    detail: (id: number | string) => `${API_V1}/test-sessions/${id}/`,
    identify: `${API_V1}/test-sessions/identify/`,
    start: `${API_V1}/test-sessions/start/`,
    submit: (id: number | string) => `${API_V1}/test-sessions/${id}/submit/`,
    export: `${API_V1}/test-sessions/export/`,
  },
  medicalChecks: {
    list: `${API_V1}/medical-checks/`,
    detail: (id: number | string) => `${API_V1}/medical-checks/${id}/`,
    export: `${API_V1}/medical-checks/export/`,
  },
  dashboard: {
    stats: `${API_V1}/dashboard/stats/`,
  },
} as const;
