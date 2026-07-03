import { fireEvent, render, screen, waitFor } from 'src/test-utils';

import BlockUpsertDialog from '../block-upsert-dialog';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({ tx: (k: string) => k, currentLang: { value: 'ru' } }),
}));

const createMock = jest.fn().mockResolvedValue({ id: 1, test: 5, order: 0, title: 'B' });
jest.mock('../../../api/use-surveys-api', () => ({
  useCreateQuestionBlockMutation: () => ({ mutateAsync: createMock, isPending: false }),
  useUpdateQuestionBlockMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar: jest.fn() }),
}));

describe('BlockUpsertDialog', () => {
  it('creates a block for the given test id', async () => {
    render(<BlockUpsertDialog open testId={5} block={null} onClose={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.change(screen.getByLabelText(/surveys.blocks.form.title/), {
      target: { value: 'Intro' },
    });
    fireEvent.click(screen.getByText('common.actions.save'));
    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(createMock.mock.calls[0][0]).toMatchObject({ test: 5, title: 'Intro' });
  });
});
