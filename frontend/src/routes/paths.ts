export const paths = {
  login: '/login',
  home: '/home',
  /** Public, login-free survey kiosk (camera-first face + SMS OTP). Each step is its own route. */
  scan: '/scan',
  scanManual: '/scan/manual',
  scanConfirm: (employeeId: number | string) => `/scan/confirm/${employeeId}`,
  scanOtp: (employeeId: number | string) => `/scan/otp/${employeeId}`,
  scanAnswer: '/scan/answer',
  /** Employee's personal cabinet after face+OTP login. No :id — identity comes from the JWT (/me). */
  employee: '/employee',

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
