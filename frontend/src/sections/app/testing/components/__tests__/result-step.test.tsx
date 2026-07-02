import { fireEvent, render, screen } from 'src/test-utils';

import type { TestSession } from '../../api/types';
import ResultStep from '../result-step';

jest.mock('src/locales/use-locales', () => ({
  __esModule: true,
  default: () => ({
    tx: (key: string, _opts?: Record<string, unknown>) => key,
    currentLang: { value: 'uz' },
  }),
}));

const baseResult: TestSession = {
  id: 11,
  employee: 2,
  employeeName: 'Jane Smith',
  module: 'tech_safety',
  specialty: null,
  specialtyName: null,
  startedAt: '2026-06-10T08:00:00Z',
  finishedAt: '2026-06-10T08:10:00Z',
  score: 8,
  total: 10,
  passed: true,
  faceVerified: true,
  submitFaceVerified: null,
  requiresSubmitReverify: false,
};

describe('ResultStep', () => {
  afterEach(() => jest.clearAllMocks());

  it('renders the score, employee name and passed label key', () => {
    render(<ResultStep result={baseResult} onFinish={jest.fn()} />);

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText('common.status.passed')).toBeInTheDocument();
    expect(screen.queryByText('common.status.failed')).not.toBeInTheDocument();
  });

  it('renders the failed label key and falls back to a zero score', () => {
    render(
      <ResultStep result={{ ...baseResult, score: null, passed: false }} onFinish={jest.fn()} />
    );

    expect(screen.getByText('0 / 10')).toBeInTheDocument();
    expect(screen.getByText('common.status.failed')).toBeInTheDocument();
  });

  it('fires the reset callback from the finish button', () => {
    const onFinish = jest.fn();
    render(<ResultStep result={baseResult} onFinish={onFinish} />);

    fireEvent.click(screen.getByText('testing.result.finish'));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
