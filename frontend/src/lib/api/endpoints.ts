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
  employeeInvites: {
    create: `${API_V1}/employee-invites/`,
    validate: `${API_V1}/employee-invites/validate/`,
    register: `${API_V1}/employee-invites/register/`,
  },
  surveys: {
    // Admin CRUD
    tests: `${API_V1}/tests/`,
    test: (id: number | string) => `${API_V1}/tests/${id}/`,
    questionBlocks: `${API_V1}/question-blocks/`,
    questionBlock: (id: number | string) => `${API_V1}/question-blocks/${id}/`,
    reorderQuestionBlocks: `${API_V1}/question-blocks/reorder/`,
    questions: `${API_V1}/questions/`,
    question: (id: number | string) => `${API_V1}/questions/${id}/`,
    reorderQuestions: `${API_V1}/questions/reorder/`,
    moveQuestion: `${API_V1}/questions/move/`,
    // Kiosk + results
    sessions: `${API_V1}/survey-sessions/`,
    session: (id: number | string) => `${API_V1}/survey-sessions/${id}/`,
    identify: `${API_V1}/survey-sessions/identify/`,
    requestOtp: `${API_V1}/survey-sessions/request-otp/`,
    verifyOtp: `${API_V1}/survey-sessions/verify-otp/`,
    employeesLookup: `${API_V1}/survey-sessions/employees-lookup/`,
    due: `${API_V1}/survey-sessions/due/`,
    inProgress: `${API_V1}/survey-sessions/in-progress/`,
    start: `${API_V1}/survey-sessions/start/`,
    answer: (id: number | string) => `${API_V1}/survey-sessions/${id}/answer/`,
    submit: (id: number | string) => `${API_V1}/survey-sessions/${id}/submit/`,
    adminFill: `${API_V1}/survey-sessions/admin-fill/`,
    results: `${API_V1}/survey-sessions/results/`,
    export: `${API_V1}/survey-sessions/export/`,
  },
  dashboard: {
    stats: `${API_V1}/dashboard/stats/`,
  },
} as const;
