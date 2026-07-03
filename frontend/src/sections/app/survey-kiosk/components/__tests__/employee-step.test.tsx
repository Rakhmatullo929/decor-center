import { render, screen } from 'src/test-utils';

import EmployeeStep from '../employee-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

const employees = [
  { id: 1, fullName: 'Ivan Petrov', specialtyName: 'Fitter', photo: null },
  { id: 2, fullName: 'Olga Sern', specialtyName: 'Painter', photo: null },
];
jest.mock('../../api/use-survey-kiosk-api', () => ({
  useKioskEmployeesQuery: () => ({
    data: { results: employees, count: 2 },
    isPending: false,
  }),
}));

describe('kiosk EmployeeStep', () => {
  it('lists active employees for selection', () => {
    render(<EmployeeStep onSelect={jest.fn()} />);
    expect(screen.getByText('Ivan Petrov')).toBeInTheDocument();
    expect(screen.getByText('Olga Sern')).toBeInTheDocument();
  });
});
