import { fireEvent, render, screen, waitFor, within } from 'src/test-utils';

import type { Question } from '../../api/types';
import QuestionUpsertDialog from '../question-upsert-dialog';

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

// error-reader imports axios (ESM) which jest cannot parse with the CRA transform config.
jest.mock('src/utils/error-reader', () => ({
  errorReader: (error: unknown) => String(error),
}));

const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();
jest.mock('../../api/use-questions-api', () => ({
  useCreateQuestionMutation: () => ({ mutateAsync: mockCreateMutateAsync, isPending: false }),
  useUpdateQuestionMutation: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));

jest.mock('../../../specialties/api/use-specialties-api', () => ({
  useSpecialtyOptionsQuery: () => ({
    data: { results: [{ id: 3, name: 'Mechanic' }] },
    isPending: false,
  }),
}));

const editingQuestion: Question = {
  id: 7,
  module: 'specialty',
  specialty: 3,
  specialtyName: 'Mechanic',
  text: 'Existing question text',
  options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
  correctOption: 2,
  source: 'manual',
  status: 'draft',
  createdAt: '2026-01-15T10:00:00Z',
};

function renderDialog(question: Question | null = null) {
  const onClose = jest.fn();
  const onSaved = jest.fn();

  render(
    <QuestionUpsertDialog open onClose={onClose} question={question} onSaved={onSaved} />
  );

  return { onClose, onSaved };
}

function openSelect(name: RegExp) {
  fireEvent.mouseDown(screen.getByRole('button', { name }));
  return screen.getByRole('listbox');
}

describe('QuestionUpsertDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders create mode fields without the specialty select', () => {
    renderDialog();

    expect(screen.getByText('questions.form.createTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /questions\.form\.module/ })).toBeInTheDocument();
    expect(screen.getByLabelText('questions.form.text *')).toBeInTheDocument();
    expect(screen.getAllByLabelText('questions.form.option *')).toHaveLength(4);
    expect(
      screen.getByRole('button', { name: /questions\.form\.correctOption/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /questions\.form\.specialty/ })
    ).not.toBeInTheDocument();
  });

  it('shows the specialty select only when module is specialty', async () => {
    renderDialog();

    const listbox = openSelect(/questions\.form\.module/);
    fireEvent.click(within(listbox).getByText('common.modules.specialty'));

    expect(
      await screen.findByRole('button', { name: /questions\.form\.specialty/ })
    ).toBeInTheDocument();
  });

  it('renders edit mode with prefilled values and the edit title', () => {
    renderDialog(editingQuestion);

    expect(screen.getByText('questions.form.editTitle')).toBeInTheDocument();
    expect(screen.getByLabelText('questions.form.text *')).toHaveValue('Existing question text');
    expect(screen.getByRole('button', { name: /questions\.form\.specialty/ })).toHaveTextContent(
      'Mechanic'
    );

    const optionInputs = screen.getAllByLabelText('questions.form.option *');
    expect(optionInputs[0]).toHaveValue('Opt A');
    expect(optionInputs[3]).toHaveValue('Opt D');
  });

  it('blocks submit and shows validation keys when required fields are empty', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'common.actions.save' }));

    expect(await screen.findByText('questions.validation.textRequired')).toBeInTheDocument();
    expect(screen.getByText('questions.validation.moduleRequired')).toBeInTheDocument();
    expect(screen.getAllByText('questions.validation.optionRequired')).toHaveLength(4);
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('submits the create payload and fires onSaved and onClose', async () => {
    const savedQuestion: Question = {
      ...editingQuestion,
      id: 99,
      module: 'tech_safety',
      specialty: null,
      specialtyName: null,
    };
    mockCreateMutateAsync.mockResolvedValue(savedQuestion);

    const { onClose, onSaved } = renderDialog();

    const moduleListbox = openSelect(/questions\.form\.module/);
    fireEvent.click(within(moduleListbox).getByText('common.modules.techSafety'));

    fireEvent.change(screen.getByLabelText('questions.form.text *'), {
      target: { value: 'New question text' },
    });

    const optionInputs = screen.getAllByLabelText('questions.form.option *');
    optionInputs.forEach((input, index) => {
      fireEvent.change(input, { target: { value: `Option ${index + 1}` } });
    });

    const correctListbox = openSelect(/questions\.form\.correctOption/);
    fireEvent.click(within(correctListbox).getByText('B'));

    fireEvent.click(screen.getByRole('button', { name: 'common.actions.save' }));

    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      module: 'tech_safety',
      specialty: null,
      text: 'New question text',
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      correctOption: 1,
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedQuestion, 'create'));
    expect(onClose).toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('questions.toasts.created');
  });

  it('submits the edit payload with the question id', async () => {
    const savedQuestion: Question = { ...editingQuestion, text: 'Existing question text' };
    mockUpdateMutateAsync.mockResolvedValue(savedQuestion);

    const { onClose, onSaved } = renderDialog(editingQuestion);

    fireEvent.click(screen.getByRole('button', { name: 'common.actions.save' }));

    await waitFor(() => expect(mockUpdateMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      id: 7,
      payload: {
        module: 'specialty',
        specialty: 3,
        text: 'Existing question text',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        correctOption: 2,
      },
    });

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedQuestion, 'edit'));
    expect(onClose).toHaveBeenCalled();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });
});
