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
    questions: '/questions',
    instructions: '/instructions',
    results: {
      root: '/results',
      detail: (id: number | string) => `/results/${id}`,
    },
    medical: {
      root: '/medical',
      create: (employeeId: number | string) => `/medical/new/${employeeId}`,
      detail: (id: number | string) => `/medical/${id}`,
      edit: (id: number | string) => `/medical/${id}/edit`,
    },
    testing: {
      root: '/testing',
      questions: (specialistId: number | string, module: string) =>
        `/testing/tests/${specialistId}/${module}`,
    },
  },
};
