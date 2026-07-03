import { buildPermission, checkPermission } from '../permissions';

describe('survey permissions', () => {
  it('builds admin survey keys', () => {
    expect(buildPermission('tests', 'write')).toBe('tests:write');
    expect(buildPermission('results', 'read')).toBe('results:read');
  });
  it('builds the kiosk submit key', () => {
    expect(buildPermission('survey', 'submit')).toBe('survey:submit');
  });
  it('checks membership', () => {
    expect(checkPermission(['survey:submit'], 'survey', 'submit')).toBe(true);
    expect(checkPermission(['tests:read'], 'tests', 'write')).toBe(false);
  });
});
