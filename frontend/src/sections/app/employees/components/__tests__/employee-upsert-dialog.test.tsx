import userEvent from '@testing-library/user-event';

import { render, screen, waitFor } from 'src/test-utils';

import type { Employee } from '../../api/types';
import EmployeeUpsertDialog from '../employee-upsert-dialog';

// ----------------------------------------------------------------------

const mockEnqueueSnackbar = jest.fn();
const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();
const mockUseSpecialtyOptionsQuery = jest.fn();

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

// error-reader imports axios (ESM) which CRA's Jest cannot transform.
jest.mock('src/utils/error-reader', () => ({
  errorReader: () => 'mock-error',
}));

// Dropzone-based avatar upload is replaced with a deterministic file setter.
jest.mock('src/components/hook-form', () => {
  const actual = jest.requireActual('src/components/hook-form');
  const { useFormContext } = jest.requireActual('react-hook-form');

  function MockUploadAvatar({ name }: { name: string }) {
    const { setValue, formState } = useFormContext();
    const fieldError = formState.errors[name];
    return (
      <div>
        <button
          type="button"
          onClick={() =>
            setValue(name, new File(['photo'], 'photo.png', { type: 'image/png' }), {
              shouldValidate: true,
            })
          }
        >
          mock-upload-photo
        </button>
        {!!fieldError && <span>{String(fieldError.message)}</span>}
      </div>
    );
  }

  return { ...actual, __esModule: true, RHFUploadAvatar: MockUploadAvatar };
});

jest.mock('../../api/use-face-photos-api', () => ({
  useFacePhotosQuery: () => ({ data: [], isPending: false, refetch: jest.fn() }),
  useAddFacePhotoMutation: () => ({ mutateAsync: jest.fn() }),
  useDeleteFacePhotoMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('../../api/use-employees-api', () => ({
  useCreateEmployeeMutation: () => ({
    mutate: jest.fn(),
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateEmployeeMutation: () => ({
    mutate: jest.fn(),
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

jest.mock('../../../specialties/api/use-specialties-api', () => ({
  useSpecialtyOptionsQuery: () => mockUseSpecialtyOptionsQuery(),
}));

// ----------------------------------------------------------------------

const employee: Employee = {
  id: 5,
  fullName: 'Alisher Karimov',
  specialty: 2,
  specialtyName: 'Welder',
  photo: 'https://example.com/photo.jpg',
  isActive: true,
  hireDate: null,
  workExperience: null,
  createdAt: '2026-01-15T10:00:00Z',
};

const savedEmployee: Employee = { ...employee, id: 9, fullName: 'John Doe', specialty: 1 };

function renderDialog(props?: { employee?: Employee | null }) {
  const onClose = jest.fn();
  const onSaved = jest.fn();

  const utils = render(
    <EmployeeUpsertDialog
      open
      onClose={onClose}
      employee={props?.employee ?? null}
      onSaved={onSaved}
    />
  );

  return { ...utils, onClose, onSaved };
}

describe('EmployeeUpsertDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSpecialtyOptionsQuery.mockReturnValue({
      data: {
        results: [
          { id: 1, name: 'Therapist', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
          { id: 2, name: 'Welder', isActive: true, createdAt: '2026-01-01T00:00:00Z' },
        ],
        count: 2,
      },
      isPending: false,
    });
  });

  it('renders create mode: create title, empty name, no active switch', () => {
    renderDialog();

    expect(screen.getByText('employees.form.createTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('employees.form.fullName *')).toHaveValue('');
    expect(screen.queryByText('employees.form.active')).not.toBeInTheDocument();
  });

  it('renders edit mode: edit title, prefilled name, active switch', () => {
    renderDialog({ employee });

    expect(screen.getByText('employees.form.editTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('employees.form.fullName *')).toHaveValue('Alisher Karimov');
    expect(screen.getByText('employees.form.active')).toBeInTheDocument();
  });

  it('blocks submit and shows validation keys when required fields are empty', async () => {
    const user = userEvent.setup();
    const { onSaved } = renderDialog();

    await user.click(screen.getByText('common.actions.save'));

    expect(
      await screen.findByText('employees.validation.fullNameRequired')
    ).toBeInTheDocument();
    expect(screen.getByText('employees.validation.specialtyRequired')).toBeInTheDocument();
    expect(screen.getByText('employees.validation.photoRequired')).toBeInTheDocument();

    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('successful create calls the create mutation with the payload and fires onSaved/onClose', async () => {
    const user = userEvent.setup();
    mockCreateMutateAsync.mockResolvedValue(savedEmployee);

    const { onSaved, onClose } = renderDialog();

    await user.type(screen.getByLabelText('employees.form.fullName *'), 'John Doe');

    await user.click(screen.getByLabelText('employees.form.specialty *'));
    await user.click(await screen.findByRole('option', { name: 'Therapist' }));

    await user.click(screen.getByText('mock-upload-photo'));

    await user.click(screen.getByText('common.actions.save'));

    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      fullName: 'John Doe',
      specialty: 1,
      isActive: true,
      photo: expect.any(File),
    });

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('employees.toasts.created');
    expect(onSaved).toHaveBeenCalledWith(savedEmployee, 'create');
    expect(onClose).toHaveBeenCalled();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('successful edit calls the update mutation without a photo when it was not replaced', async () => {
    const user = userEvent.setup();
    const updated = { ...employee, fullName: 'Alisher K.' };
    mockUpdateMutateAsync.mockResolvedValue(updated);

    const { onSaved, onClose } = renderDialog({ employee });

    const nameField = screen.getByLabelText('employees.form.fullName *');
    await user.clear(nameField);
    await user.type(nameField, 'Alisher K.');

    await user.click(screen.getByText('common.actions.save'));

    await waitFor(() => expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 5,
      payload: { fullName: 'Alisher K.', specialty: 2, isActive: true },
    });

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('employees.toasts.updated');
    expect(onSaved).toHaveBeenCalledWith(updated, 'edit');
    expect(onClose).toHaveBeenCalled();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it('shows the backend error and keeps the dialog open when the mutation rejects', async () => {
    const user = userEvent.setup();
    mockUpdateMutateAsync.mockRejectedValue({
      response: { data: { detail: 'No face detected' } },
    });

    const { onSaved, onClose } = renderDialog({ employee });

    await user.click(screen.getByText('common.actions.save'));

    expect(await screen.findByRole('alert')).toHaveTextContent('mock-error');
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
