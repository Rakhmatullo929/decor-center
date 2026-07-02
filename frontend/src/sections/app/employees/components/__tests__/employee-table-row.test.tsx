import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';

import { render, screen } from 'src/test-utils';

import type { Employee } from '../../api/types';
import EmployeeTableRow from '../employee-table-row';

// ----------------------------------------------------------------------

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

// ----------------------------------------------------------------------

const activeEmployee: Employee = {
  id: 7,
  fullName: 'Alisher Karimov',
  specialty: 3,
  specialtyName: 'Electrician',
  photo: null,
  isActive: true,
  createdAt: '2026-01-15T10:00:00Z',
};

const archivedEmployee: Employee = {
  ...activeEmployee,
  id: 8,
  fullName: 'Bobur Toshev',
  specialtyName: 'Welder',
  isActive: false,
};

type RowProps = Partial<ComponentProps<typeof EmployeeTableRow>>;

function renderRow(props?: RowProps) {
  const onEdit = jest.fn();
  const onToggleActive = jest.fn();

  const utils = render(
    <table>
      <tbody>
        <EmployeeTableRow
          row={activeEmployee}
          canWrite
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          {...props}
        />
      </tbody>
    </table>
  );

  return { ...utils, onEdit, onToggleActive };
}

describe('EmployeeTableRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders name, specialty and active status key', () => {
    renderRow();

    expect(screen.getByText('Alisher Karimov')).toBeInTheDocument();
    expect(screen.getByText('Electrician')).toBeInTheDocument();
    expect(screen.getByText('common.status.active')).toBeInTheDocument();
  });

  it('renders inactive status key for an archived employee', () => {
    renderRow({ row: archivedEmployee });

    expect(screen.getByText('common.status.inactive')).toBeInTheDocument();
  });

  it('hides the actions cell when canWrite is false', () => {
    renderRow({ canWrite: false });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onEdit with the row from the popover edit action', async () => {
    const user = userEvent.setup();
    const { onEdit } = renderRow();

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText('common.actions.edit'));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(activeEmployee);
  });

  it('shows archive action for an active employee and calls onToggleActive', async () => {
    const user = userEvent.setup();
    const { onToggleActive } = renderRow();

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText('employees.actions.archive'));

    expect(onToggleActive).toHaveBeenCalledTimes(1);
    expect(onToggleActive).toHaveBeenCalledWith(activeEmployee);
  });

  it('shows activate action for an archived employee', async () => {
    const user = userEvent.setup();
    const { onToggleActive } = renderRow({ row: archivedEmployee });

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText('employees.actions.activate'));

    expect(screen.queryByText('employees.actions.archive')).not.toBeInTheDocument();
    expect(onToggleActive).toHaveBeenCalledWith(archivedEmployee);
  });
});
