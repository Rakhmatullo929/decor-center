import { dashboardRoutes } from '../dashboard';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paths(children: any[]): string[] {
  return children.map((c) => c.path).filter(Boolean);
}

describe('dashboardRoutes', () => {
  it('registers the survey admin routes and drops depo routes', () => {
    const { children } = dashboardRoutes[0];
    const p = paths(children);
    expect(p).not.toContain('surveys/tests');
    expect(p).toContain('surveys/tests/:testId/blocks');
    expect(p).toContain('surveys/tests/:testId/blocks/:blockId');
    expect(p).toContain('surveys/results');
    expect(p).not.toContain('medical');
    expect(p).not.toContain('testing');
  });
});
