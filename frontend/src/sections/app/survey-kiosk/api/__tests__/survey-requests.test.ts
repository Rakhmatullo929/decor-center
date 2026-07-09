import { API_ENDPOINTS } from 'src/lib/api/endpoints';

import * as requests from '../survey-requests';

jest.mock('src/utils/axios', () => ({
  API_ENDPOINTS: jest.requireActual('src/lib/api/endpoints').API_ENDPOINTS,
  request: jest.fn().mockResolvedValue({ ok: true }),
}));
// eslint-disable-next-line import/first, @typescript-eslint/no-var-requires
const { request } = require('src/utils/axios');

describe('survey-kiosk requests', () => {
  beforeEach(() => (request as jest.Mock).mockClear());

  it('identify posts multipart face_image (snake_case), public', async () => {
    const file = new File(['x'], 'f.jpg', { type: 'image/jpeg' });
    await requests.identifyEmployee({ faceImage: file });
    const [call, isPublic] = (request as jest.Mock).mock.calls[0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.identify);
    expect(call.data instanceof FormData).toBe(true);
    expect((call.data as FormData).get('face_image')).toBe(file);
    expect(isPublic).toBe(true);
  });

  it('requestOtp posts the employee id, public', async () => {
    await requests.requestOtp(9);
    const [call, isPublic] = (request as jest.Mock).mock.calls[0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.requestOtp);
    expect(call.data).toEqual({ employee: 9 });
    expect(isPublic).toBe(true);
  });

  it('verifyOtp posts employee/code/fallback, public', async () => {
    await requests.verifyOtp({ employeeId: 9, code: '0000', fallback: true });
    const [call] = (request as jest.Mock).mock.calls[0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.verifyOtp);
    expect(call.data).toEqual({ employee: 9, code: '0000', fallback: true });
  });

  it('employeesLookup passes the q param', async () => {
    await requests.employeesLookup('iv');
    const [call] = (request as jest.Mock).mock.calls[0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.employeesLookup);
    expect(call.params).toEqual({ q: 'iv' });
  });

  it('fetchDueSurveys passes the employee param, bearer-authed (not public)', async () => {
    await requests.fetchDueSurveys(9);
    const [call, isPublic] = (request as jest.Mock).mock.calls[0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.due);
    expect(call.params).toEqual({ employee: 9 });
    expect(isPublic).toBeFalsy();
  });

  it('startSurvey posts employee/test/face_image, bearer-authed (not public)', async () => {
    const file = new File(['x'], 'f.jpg', { type: 'image/jpeg' });
    await requests.startSurvey({ employee: 2, test: 5, faceImage: file });
    const [call, isPublic] = (request as jest.Mock).mock.calls[0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.start);
    const fd = call.data as FormData;
    expect(fd.get('employee')).toBe('2');
    expect(fd.get('test')).toBe('5');
    expect(fd.get('face_image')).toBe(file);
    expect(isPublic).toBeFalsy();
  });

  it('startSurvey omits face_image on the manual fallback', async () => {
    await requests.startSurvey({ employee: 2, test: 5 });
    const [call] = (request as jest.Mock).mock.calls[0];
    const fd = call.data as FormData;
    expect(fd.get('face_image')).toBeNull();
  });

  it('submitSurvey posts JSON answers, bearer-authed (not public)', async () => {
    await requests.submitSurvey(7, {
      answers: [
        { question: 1, selectedOptionIds: ['a'] },
        { question: 2, textValue: 'hi' },
      ],
    });
    const [call, isPublic] = (request as jest.Mock).mock.calls[0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.submit(7));
    expect(call.data.answers).toHaveLength(2);
    expect(isPublic).toBeFalsy();
  });
});
