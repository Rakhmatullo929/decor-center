import { buildEmployeeBody } from '../employees-requests';

describe('buildEmployeeBody', () => {
  it('JSON body carries hireDate/workExperience when no photo', () => {
    const body = buildEmployeeBody({
      fullName: 'A',
      specialty: 1,
      isActive: true,
      hireDate: '2024-02-01',
      workExperience: 5,
    }) as Record<string, unknown>;
    expect(body).toMatchObject({ hireDate: '2024-02-01', workExperience: 5 });
    expect(body instanceof FormData).toBe(false);
  });
  it('FormData uses snake_case keys when a photo is present', () => {
    const file = new File(['x'], 'p.jpg', { type: 'image/jpeg' });
    const body = buildEmployeeBody({
      fullName: 'A',
      specialty: 1,
      isActive: true,
      photo: file,
      hireDate: '2024-02-01',
      workExperience: 5,
    }) as FormData;
    expect(body instanceof FormData).toBe(true);
    expect(body.get('hire_date')).toBe('2024-02-01');
    expect(body.get('work_experience')).toBe('5');
  });
});
