export const paths = {
  login: '/login',
  home: '/home',

  page403: '/403',
  page404: '/404',
  page500: '/500',
  maintenance: '/maintenance',

  auth: {
    jwt: {
      login: '/login',
    },
  },

  app: {
    dashboard: '/dashboard',
    employees: '/employees',
    specialties: '/specialties',
    surveys: {
      blocks: (testId: number | string) => `/surveys/tests/${testId}/blocks`,
      block: (testId: number | string, blockId: number | string) =>
        `/surveys/tests/${testId}/blocks/${blockId}`,
      results: '/surveys/results',
    },
    kiosk: {
      root: '/kiosk',
      due: (employeeId: number | string) => `/kiosk/${employeeId}/due`,
      answer: '/kiosk/answer',
      thankYou: '/kiosk/thank-you',
    },
  },
};
