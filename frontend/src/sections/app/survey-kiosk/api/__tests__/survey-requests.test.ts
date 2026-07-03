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

  it('identify posts multipart face_image (snake_case)', async () => {
    const file = new File(['x'], 'f.jpg', { type: 'image/jpeg' });
    await requests.identifyEmployee({ faceImage: file });
    const call = (request as jest.Mock).mock.calls[0][0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.identify);
    expect(call.data instanceof FormData).toBe(true);
    expect((call.data as FormData).get('face_image')).toBe(file);
  });

  it('fetchDueSurveys passes employee param', async () => {
    await requests.fetchDueSurveys(9);
    const call = (request as jest.Mock).mock.calls[0][0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.due);
    expect(call.params).toEqual({ employee: 9 });
  });

  it('startSurvey posts employee/test/face_image as FormData', async () => {
    const file = new File(['x'], 'f.jpg', { type: 'image/jpeg' });
    await requests.startSurvey({ employee: 2, test: 5, faceImage: file });
    const call = (request as jest.Mock).mock.calls[0][0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.start);
    const fd = call.data as FormData;
    expect(fd.get('employee')).toBe('2');
    expect(fd.get('test')).toBe('5');
    expect(fd.get('face_image')).toBe(file);
  });

  it('submitSurvey posts JSON answers to the submit action', async () => {
    await requests.submitSurvey(7, {
      answers: [
        { question: 1, selectedOptionIds: ['a'] },
        { question: 2, textValue: 'hi' },
      ],
    });
    const call = (request as jest.Mock).mock.calls[0][0];
    expect(call.url).toBe(API_ENDPOINTS.surveys.submit(7));
    expect(call.data.answers).toHaveLength(2);
  });
});
