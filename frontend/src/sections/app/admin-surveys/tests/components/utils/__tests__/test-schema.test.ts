import { buildTestSchema } from '../test-schema';

const tx = (k: string) => k;

describe('test schema — scheduling validation', () => {
  it('requires afterDays when isAfterApplication is on', async () => {
    const schema = buildTestSchema(tx);
    await expect(
      schema.validate({
        title: 'T',
        isActive: true,
        isAdminConducted: false,
        isAfterApplication: true,
        afterDays: null,
        testDaysFrom: null,
        testDaysTo: null,
        month: [],
      })
    ).rejects.toThrow('surveys.tests.validation.afterDaysRequired');
  });

  it('accepts a periodic config (month multiselect + day window)', async () => {
    const schema = buildTestSchema(tx);
    const value = await schema.validate({
      title: 'Pulse',
      isActive: true,
      isAdminConducted: false,
      isAfterApplication: false,
      afterDays: null,
      testDaysFrom: 1,
      testDaysTo: 7,
      month: [1, 4, 7, 10],
    });
    expect(value.month).toEqual([1, 4, 7, 10]);
    expect(value.testDaysTo).toBe(7);
  });

  it('rejects testDaysTo < testDaysFrom', async () => {
    const schema = buildTestSchema(tx);
    await expect(
      schema.validate({
        title: 'T',
        isActive: true,
        isAdminConducted: false,
        isAfterApplication: false,
        afterDays: null,
        testDaysFrom: 10,
        testDaysTo: 3,
        month: [],
      })
    ).rejects.toThrow('surveys.tests.validation.dayRange');
  });
});
