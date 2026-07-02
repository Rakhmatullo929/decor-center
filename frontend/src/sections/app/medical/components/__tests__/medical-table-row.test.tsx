import { fireEvent, render, screen } from 'src/test-utils';

import type { MedicalCheck } from '../../api/types';
import MedicalTableRow from '../medical-table-row';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

const baseRow: MedicalCheck = {
  id: 1,
  employee: 7,
  employeeName: 'John Doe',
  bpSystolic: 120,
  bpDiastolic: 80,
  pulse: 70,
  saturation: 98,
  alcoholValue: '0.150',
  alcoholPositive: false,
  hoursWorked: '8.0',
  hoursRested: '12.5',
  conclusion: 'approved',
  note: '',
  medic: 3,
  medicUsername: 'medic1',
  createdAt: '2026-06-10T08:00:00Z',
};

function renderRow(
  row: MedicalCheck,
  options?: { canWrite?: boolean; onDetail?: jest.Mock; onEdit?: jest.Mock }
) {
  const onDetail = options?.onDetail ?? jest.fn();
  const onEdit = options?.onEdit ?? jest.fn();
  const view = render(
    <table>
      <tbody>
        <MedicalTableRow
          row={row}
          canWrite={options?.canWrite ?? false}
          onDetail={onDetail}
          onEdit={onEdit}
        />
      </tbody>
    </table>
  );
  return { onDetail, onEdit, ...view };
}

describe('MedicalTableRow', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders BP as systolic/diastolic, vitals and names', () => {
    renderRow(baseRow);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('120/80')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('medic1')).toBeInTheDocument();
  });

  it('formats DRF decimal strings without trailing zeros', () => {
    renderRow(baseRow);

    // hoursWorked '8.0' → '8', hoursRested '12.5' stays, alcoholValue '0.150' → '0.15'
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('12.5')).toBeInTheDocument();
    expect(screen.getByText('0.15')).toBeInTheDocument();
  });

  it('renders the approved conclusion label key', () => {
    renderRow(baseRow);

    expect(screen.getByText('medical.conclusion.approved')).toBeInTheDocument();
  });

  it('renders the rejected conclusion label key', () => {
    renderRow({ ...baseRow, conclusion: 'rejected' });

    expect(screen.getByText('medical.conclusion.rejected')).toBeInTheDocument();
  });

  it('renders a dash when alcohol was not measured', () => {
    renderRow({ ...baseRow, alcoholValue: null });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the measured value when the alcohol test is positive', () => {
    renderRow({ ...baseRow, alcoholValue: '0.300', alcoholPositive: true });

    expect(screen.getByText('0.3')).toBeInTheDocument();
  });

  it('always shows the actions menu button', () => {
    renderRow(baseRow, { canWrite: false });

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('hides the edit menu item without medical:write', () => {
    renderRow(baseRow, { canWrite: false });

    fireEvent.click(screen.getByRole('button'));

    expect(screen.queryByText('common.actions.edit')).not.toBeInTheDocument();
  });

  it('fires onDetail when the view action is clicked', () => {
    const { onDetail } = renderRow(baseRow);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('common.actions.view'));

    expect(onDetail).toHaveBeenCalledWith(baseRow);
  });

  it('fires onEdit when the edit action is clicked (canWrite)', () => {
    const { onEdit } = renderRow(baseRow, { canWrite: true });

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('common.actions.edit'));

    expect(onEdit).toHaveBeenCalledWith(baseRow);
  });
});
