import { buildEmployeeSchema } from '../employee-schema';

const tx = (k: string) => k;

describe('employee schema', () => {
  it('accepts optional hireDate + workExperience', async () => {
    const schema = buildEmployeeSchema(tx);
    const value = await schema.validate({
      fullName: 'Ivan',
      specialty: 1,
      phone: '+998901234567',
      photo: 'x',
      isActive: true,
      hireDate: '2024-01-15',
      workExperience: 3,
    });
    expect(value.hireDate).toBe('2024-01-15');
    expect(value.workExperience).toBe(3);
  });
  it('coerces empty hireDate/workExperience to null-ish', async () => {
    const schema = buildEmployeeSchema(tx);
    const value = await schema.validate({
      fullName: 'Ivan',
      specialty: 1,
      phone: '+998901234567',
      photo: 'x',
      isActive: true,
      hireDate: '',
      workExperience: '',
    });
    expect(value.hireDate).toBe('');
    expect(value.workExperience).toBeNull();
  });
});
