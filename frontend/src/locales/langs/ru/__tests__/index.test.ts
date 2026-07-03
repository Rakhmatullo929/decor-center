import translation from '../index';

describe('ru locale barrel', () => {
  it('drops depo-only namespaces', () => {
    expect(translation).not.toHaveProperty('testing');
    expect(translation).not.toHaveProperty('results');
    expect(translation).not.toHaveProperty('instructions');
    expect(translation).not.toHaveProperty('medical');
    expect(translation).not.toHaveProperty('dashboard');
  });
  it('keeps the reused namespaces', () => {
    expect(translation).toHaveProperty('common');
    expect(translation).toHaveProperty('employees');
    expect(translation).toHaveProperty('specialties');
  });
});
