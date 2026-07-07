import { API_ENDPOINTS } from 'src/lib/api/endpoints';

import * as requests from '../surveys-requests';

jest.mock('src/utils/axios', () => ({
  API_ENDPOINTS: jest.requireActual('src/lib/api/endpoints').API_ENDPOINTS,
  request: jest.fn().mockResolvedValue({ ok: true }),
}));

// eslint-disable-next-line import/first, @typescript-eslint/no-var-requires
const { request } = require('src/utils/axios');

describe('surveys-requests', () => {
  beforeEach(() => (request as jest.Mock).mockClear());

  it('fetchTests hits the tests collection', async () => {
    await requests.fetchTests({ page: 1 });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: API_ENDPOINTS.surveys.tests })
    );
  });

  it('createQuestion posts to the questions collection', async () => {
    await requests.createQuestion({
      block: 3,
      type: 'single',
      order: 0,
      text: 'Q',
      options: [],
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', url: API_ENDPOINTS.surveys.questions })
    );
  });

  it('reorderQuestionBlocks posts to the reorder action', async () => {
    await requests.reorderQuestionBlocks({ test: 1, order: [2, 1] });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: API_ENDPOINTS.surveys.reorderQuestionBlocks,
        data: { test: 1, order: [2, 1] },
      })
    );
  });

  it('reorderQuestions posts to the reorder action', async () => {
    await requests.reorderQuestions({ block: 1, order: [5, 4] });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: API_ENDPOINTS.surveys.reorderQuestions,
        data: { block: 1, order: [5, 4] },
      })
    );
  });

  it('moveQuestion posts to the move action', async () => {
    await requests.moveQuestion({ question: 5, targetBlock: 2, order: [5, 4] });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: API_ENDPOINTS.surveys.moveQuestion,
        data: { question: 5, targetBlock: 2, order: [5, 4] },
      })
    );
  });

  it('exportSurveyResults requests a blob', async () => {
    await requests.exportSurveyResults({ test: 5 });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: API_ENDPOINTS.surveys.export,
        responseType: 'blob',
      })
    );
  });
});
