import userEvent from '@testing-library/user-event';

import { render, screen, waitFor } from 'src/test-utils';

import type { Specialty } from '../../api/types';
import SpecialtyUpsertDialog from '../specialty-upsert-dialog';

// ----------------------------------------------------------------------

const mockEnqueueSnackbar = jest.fn();
const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

jest.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

jest.mock('../../api/use-specialties-api', () => ({
  useCreateSpecialtyMutation: () => ({
    mutate: jest.fn(),
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateSpecialtyMutation: () => ({
    mutate: jest.fn(),
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

// ----------------------------------------------------------------------

const specialty: Specialty = {
  id: 3,
  name: 'Electrician',
  isActive: true,
  createdAt: '2026-01-10T08:00:00Z',
};

function renderDialog(props?: { specialty?: Specialty | null }) {
  const onClose = jest.fn();
  const onSaved = jest.fn();

  const utils = render(
    <SpecialtyUpsertDialog
      open
      onClose={onClose}
      specialty={props?.specialty ?? null}
      onSaved={onSaved}
    />
  );

  return { ...utils, onClose, onSaved };
}

describe('SpecialtyUpsertDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create mode: create title, empty name, no active switch', () => {
    renderDialog();

    expect(screen.getByText('specialties.form.createTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('specialties.form.name *')).toHaveValue('');
    expect(screen.queryByText('specialties.form.active')).not.toBeInTheDocument();
  });

  it('renders edit mode: edit title, prefilled name, active switch', () => {
    renderDialog({ specialty });

    expect(screen.getByText('specialties.form.editTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('specialties.form.name *')).toHaveValue('Electrician');
    expect(screen.getByText('specialties.form.active')).toBeInTheDocument();
  });

  it('blocks submit and shows the validation key when name is empty', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.click(screen.getByText('common.actions.save'));

    expect(await screen.findByText('specialties.validation.nameRequired')).toBeInTheDocument();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('successful create calls the create mutation with the payload and fires onSaved/onClose', async () => {
    const user = userEvent.setup();
    const saved: Specialty = { id: 10, name: 'Mechanic', isActive: true, createdAt: '2026-06-01T00:00:00Z' };
    mockCreateMutateAsync.mockResolvedValue(saved);

    const { onSaved, onClose } = renderDialog();

    await user.type(screen.getByLabelText('specialties.form.name *'), 'Mechanic');
    await user.click(screen.getByText('common.actions.save'));

    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({ name: 'Mechanic', isActive: true });

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('specialties.toasts.created');
    expect(onSaved).toHaveBeenCalledWith(saved, 'create');
    expect(onClose).toHaveBeenCalled();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('successful edit calls the update mutation with id and payload', async () => {
    const user = userEvent.setup();
    const updated: Specialty = { ...specialty, name: 'Chief electrician' };
    mockUpdateMutateAsync.mockResolvedValue(updated);

    const { onSaved, onClose } = renderDialog({ specialty });

    const nameField = screen.getByLabelText('specialties.form.name *');
    await user.clear(nameField);
    await user.type(nameField, 'Chief electrician');
    await user.click(screen.getByText('common.actions.save'));

    await waitFor(() => expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 3,
      payload: { name: 'Chief electrician', isActive: true },
    });

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('specialties.toasts.updated');
    expect(onSaved).toHaveBeenCalledWith(updated, 'edit');
    expect(onClose).toHaveBeenCalled();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });
});
