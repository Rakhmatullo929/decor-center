import translation from '../index';

describe('ru survey namespaces', () => {
  it('exposes kiosk + admin namespaces', () => {
    expect(translation).toHaveProperty('survey');
    expect(translation).toHaveProperty('surveys');
  });
  it('has representative keys', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    expect((translation as any).survey.kiosk.faceId.continue).toBeTruthy();
    expect((translation as any).surveys.tests.title).toBeTruthy();
    expect((translation as any).surveys.questions.types.textarea).toBeTruthy();
    expect((translation as any).common.navigation.surveys).toBeTruthy();
    expect((translation as any).employees.form.hireDate).toBeTruthy();
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
});
