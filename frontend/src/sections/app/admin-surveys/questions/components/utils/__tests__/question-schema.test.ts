import { buildQuestionSchema } from '../question-schema';

const tx = (k: string) => k;

describe('question schema', () => {
  it('textarea needs no options', async () => {
    const schema = buildQuestionSchema(tx);
    const value = await schema.validate({
      type: 'textarea',
      order: 0,
      text: 'Comments?',
      options: [],
    });
    expect(value.options).toEqual([]);
  });
  it('single requires at least two options', async () => {
    const schema = buildQuestionSchema(tx);
    await expect(
      schema.validate({
        type: 'single',
        order: 0,
        text: 'Pick',
        options: [{ id: 'a', text: 'A' }],
      })
    ).rejects.toThrow('surveys.questions.validation.minOptions');
  });
  it('single accepts two non-empty options', async () => {
    const schema = buildQuestionSchema(tx);
    const value = await schema.validate({
      type: 'single',
      order: 0,
      text: 'Pick',
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
    });
    expect(value.options).toHaveLength(2);
  });
});
