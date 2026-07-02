import { render, screen } from 'src/test-utils';

import StatCard from '../stat-card';

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Active employees" value={42} icon="solar:users-group-rounded-bold-duotone" />);

    expect(screen.getByText('Active employees')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders string values as-is', () => {
    render(<StatCard title="Score" value="8 / 10" icon="solar:chart-2-bold-duotone" color="success" />);

    expect(screen.getByText('8 / 10')).toBeInTheDocument();
  });
});
