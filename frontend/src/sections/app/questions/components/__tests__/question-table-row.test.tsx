import { fireEvent, render, screen } from 'src/test-utils';

import type { Question } from '../../api/types';
import QuestionTableRow from '../question-table-row';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

const draftQuestion: Question = {
  id: 1,
  module: 'tech_safety',
  specialty: null,
  specialtyName: null,
  text: 'What is the braking distance rule?',
  options: ['One', 'Two', 'Three', 'Four'],
  correctOption: 0,
  source: 'manual',
  status: 'draft',
  createdAt: '2026-01-15T10:00:00Z',
};

const approvedQuestion: Question = {
  ...draftQuestion,
  id: 2,
  module: 'specialty',
  specialty: 3,
  specialtyName: 'Mechanic',
  source: 'ai',
  status: 'approved',
};

type RowProps = Partial<React.ComponentProps<typeof QuestionTableRow>>;

function renderRow(props?: RowProps) {
  const onEdit = jest.fn();
  const onApprove = jest.fn();
  const onDelete = jest.fn();

  render(
    <table>
      <tbody>
        <QuestionTableRow
          row={draftQuestion}
          canWrite
          onEdit={onEdit}
          onApprove={onApprove}
          onDelete={onDelete}
          {...props}
        />
      </tbody>
    </table>
  );

  return { onEdit, onApprove, onDelete };
}

describe('QuestionTableRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders draft row with draft status and manual source keys', () => {
    renderRow();

    expect(screen.getByText('What is the braking distance rule?')).toBeInTheDocument();
    expect(screen.getByText('common.modules.techSafety')).toBeInTheDocument();
    expect(screen.getByText('common.status.draft')).toBeInTheDocument();
    expect(screen.getByText('questions.source.manual')).toBeInTheDocument();
    expect(screen.queryByText('common.status.approved')).not.toBeInTheDocument();
  });

  it('renders approved row with approved status, ai source and specialty name', () => {
    renderRow({ row: approvedQuestion });

    expect(screen.getByText('common.status.approved')).toBeInTheDocument();
    expect(screen.getByText('questions.source.ai')).toBeInTheDocument();
    expect(screen.getByText('Mechanic')).toBeInTheDocument();
    expect(screen.queryByText('common.status.draft')).not.toBeInTheDocument();
  });

  it('shows approve action for draft and calls onApprove with the row', () => {
    const { onApprove } = renderRow();

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('common.actions.approve'));

    expect(onApprove).toHaveBeenCalledWith(draftQuestion);
  });

  it('hides approve action for approved questions', () => {
    renderRow({ row: approvedQuestion });

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('common.actions.edit')).toBeInTheDocument();
    expect(screen.queryByText('common.actions.approve')).not.toBeInTheDocument();
  });

  it('calls onEdit and onDelete with the row', () => {
    const { onEdit, onDelete } = renderRow();

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('common.actions.edit'));
    expect(onEdit).toHaveBeenCalledWith(draftQuestion);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('common.actions.delete'));
    expect(onDelete).toHaveBeenCalledWith(draftQuestion);
  });

  it('hides the actions menu when canWrite is false', () => {
    renderRow({ canWrite: false });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
