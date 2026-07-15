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
  phone: '+998901234567',
  photo: null,
  isActive: true,
  hireDate: null,
  workExperience: null,
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
  const onDelete = jest.fn();

  const utils = render(
    <table>
      <tbody>
        <EmployeeTableRow
          row={activeEmployee}
          canWrite
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          onDelete={onDelete}
          {...props}
        />
      </tbody>
    </table>
  );

  return { ...utils, onEdit, onToggleActive, onDelete };
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

  it('shows deactivate action for an active employee and calls onToggleActive', async () => {
    const user = userEvent.setup();
    const { onToggleActive } = renderRow();

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText('employees.actions.deactivate'));

    expect(onToggleActive).toHaveBeenCalledTimes(1);
    expect(onToggleActive).toHaveBeenCalledWith(activeEmployee);
  });

  it('shows activate action for an inactive employee', async () => {
    const user = userEvent.setup();
    const { onToggleActive } = renderRow({ row: archivedEmployee });

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText('employees.actions.activate'));

    expect(screen.queryByText('employees.actions.deactivate')).not.toBeInTheDocument();
    expect(onToggleActive).toHaveBeenCalledWith(archivedEmployee);
  });

  it('shows delete action and calls onDelete with the row', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderRow();

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText('employees.actions.delete'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(activeEmployee);
  });

  it('renders hire date and work experience', () => {
    renderRow({
      row: {
        ...activeEmployee,
        hireDate: '2024-01-15',
        workExperience: 3,
      },
      canWrite: false,
    });

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });
});
