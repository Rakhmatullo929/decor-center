import { buildRegisterBody } from '../employee-invites-requests';

describe('buildRegisterBody', () => {
  it('builds multipart FormData with snake_case keys', () => {
    const file = new File(['x'], 'face.jpg', { type: 'image/jpeg' });
    const body = buildRegisterBody({
      token: 'abc',
      fullName: 'Yangi Xodim',
      phone: '+998901112233',
      workExperience: 4,
      photo: file,
    });
    expect(body instanceof FormData).toBe(true);
    expect(body.get('token')).toBe('abc');
    expect(body.get('full_name')).toBe('Yangi Xodim');
    expect(body.get('phone')).toBe('+998901112233');
    expect(body.get('work_experience')).toBe('4');
    expect(body.get('photo')).toBe(file);
  });
});
