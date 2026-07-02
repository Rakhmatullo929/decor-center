import userEvent from '@testing-library/user-event';

import { fireEvent, render, screen, waitFor } from 'src/test-utils';

import type { MedicalCheck } from '../../api/types';
import MedicalCheckUpsertDialog from '../medical-check-upsert-dialog';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

const mockEnqueueSnackbar = jest.fn();
jest.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

// error-reader imports axios (ESM-only), which CRA's jest transform does not handle.
jest.mock('src/utils/error-reader', () => ({
  errorReader: (error: unknown) => String(error),
}));

const mockUseEmployeesQuery = jest.fn();
jest.mock('../../../employees/api/use-employees-api', () => ({
  useEmployeesQuery: (...args: unknown[]) => mockUseEmployeesQuery(...args),
}));

const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();
jest.mock('../../api/use-medical-api', () => ({
  useCreateMedicalCheckMutation: () => ({ mutateAsync: mockCreateMutateAsync, isPending: false }),
  useUpdateMedicalCheckMutation: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));

const employees = [
  { id: 1, fullName: 'John Doe' },
  { id: 2, fullName: 'Jane Roe' },
];

const savedCheck: MedicalCheck = {
  id: 5,
  employee: 1,
  employeeName: 'John Doe',
  bpSystolic: 120,
  bpDiastolic: 80,
  pulse: 70,
  saturation: 98,
  alcoholValue: null,
  alcoholPositive: false,
  hoursWorked: '8',
  hoursRested: '12',
  conclusion: 'approved',
  note: '',
  medic: 3,
  medicUsername: 'medic1',
  createdAt: '2026-06-10T08:00:00Z',
};

function setNumberField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillVitals() {
  setNumberField('medical.form.bpSystolic *', '120');
  setNumberField('medical.form.bpDiastolic *', '80');
  setNumberField('medical.form.pulse *', '70');
  setNumberField('medical.form.saturation *', '98');
  setNumberField('medical.form.hoursWorked *', '8');
  setNumberField('medical.form.hoursRested *', '12');
}

async function selectEmployee(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('medical.form.employee *'));
  await user.click(await screen.findByRole('option', { name }));
}

function renderDialog(props?: { check?: MedicalCheck | null; onClose?: jest.Mock; onSaved?: jest.Mock }) {
  const onClose = props?.onClose ?? jest.fn();
  const onSaved = props?.onSaved ?? jest.fn();
  const view = render(
    <MedicalCheckUpsertDialog open onClose={onClose} check={props?.check ?? null} onSaved={onSaved} />
  );
  return { onClose, onSaved, ...view };
}

describe('MedicalCheckUpsertDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEmployeesQuery.mockReturnValue({
      data: { results: employees, count: employees.length },
      isPending: false,
      isFetching: false,
    });
  });

  it('renders the create mode title and fields', () => {
    renderDialog();

    expect(screen.getByText('medical.form.createTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('medical.form.employee *')).toBeInTheDocument();
    expect(screen.getByLabelText('medical.form.bpSystolic *')).toBeInTheDocument();
    expect(screen.getByLabelText('medical.form.saturation *')).toBeInTheDocument();
    expect(screen.getByLabelText('medical.form.alcoholValue')).toBeInTheDocument();
    expect(screen.getByText('common.actions.save')).toBeInTheDocument();
  });

  it('renders the edit mode title with prefilled values', () => {
    renderDialog({ check: savedCheck });

    expect(screen.getByText('medical.form.editTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('medical.form.employee *')).toHaveValue('John Doe');
    expect(screen.getByLabelText('medical.form.bpSystolic *')).toHaveValue(120);
    expect(screen.getByLabelText('medical.form.saturation *')).toHaveValue(98);
  });

  it('blocks submit and shows a validation message for saturation out of range', async () => {
    renderDialog();

    setNumberField('medical.form.saturation *', '120');
    fireEvent.click(screen.getByText('common.actions.save'));

    expect(await screen.findAllByText('common.validation.maxValue')).not.toHaveLength(0);
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it('shows the risk warning when saturation drops below 92', async () => {
    renderDialog();

    expect(screen.queryByText('medical.warnings.outOfRange')).not.toBeInTheDocument();

    setNumberField('medical.form.saturation *', '91');

    expect(await screen.findByText('medical.warnings.outOfRange')).toBeInTheDocument();
  });

  it('shows the risk warning when the alcohol test is positive', async () => {
    renderDialog();

    expect(screen.queryByText('medical.warnings.outOfRange')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('medical.form.alcoholPositive'));

    expect(await screen.findByText('medical.warnings.outOfRange')).toBeInTheDocument();
  });

  it('submits the create payload and fires onSaved/onClose', async () => {
    mockCreateMutateAsync.mockResolvedValue(savedCheck);
    const { onClose, onSaved } = renderDialog();

    await selectEmployee('John Doe');
    fillVitals();
    fireEvent.click(screen.getByText('common.actions.save'));

    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      employee: 1,
      bpSystolic: 120,
      bpDiastolic: 80,
      pulse: 70,
      saturation: 98,
      alcoholValue: null,
      alcoholPositive: false,
      hoursWorked: '8',
      hoursRested: '12',
      conclusion: 'approved',
      note: '',
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedCheck, 'create'));
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('medical.toasts.created');
    expect(onClose).toHaveBeenCalled();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('submits the edit payload with the record id and fires onSaved with edit mode', async () => {
    const updated = { ...savedCheck, pulse: 72 };
    mockUpdateMutateAsync.mockResolvedValue(updated);
    const { onClose, onSaved } = renderDialog({ check: savedCheck });

    setNumberField('medical.form.pulse *', '72');
    fireEvent.click(screen.getByText('common.actions.save'));

    await waitFor(() => expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 5,
      payload: expect.objectContaining({ employee: 1, pulse: 72, conclusion: 'approved' }),
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated, 'edit'));
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('medical.toasts.updated');
    expect(onClose).toHaveBeenCalled();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it('shows the submit error and keeps the dialog open when the mutation fails', async () => {
    mockCreateMutateAsync.mockRejectedValue('range error');
    const { onClose, onSaved } = renderDialog();

    await selectEmployee('Jane Roe');
    fillVitals();
    fireEvent.click(screen.getByText('common.actions.save'));

    expect(await screen.findByText('range error')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
