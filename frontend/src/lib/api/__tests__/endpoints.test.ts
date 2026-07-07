import { API_ENDPOINTS } from '../endpoints';

describe('API_ENDPOINTS.surveys', () => {
  const s = API_ENDPOINTS.surveys;
  it('exposes admin CRUD collections', () => {
    expect(s.tests).toBe('/api/v1/tests/');
    expect(s.test(7)).toBe('/api/v1/tests/7/');
    expect(s.questionBlocks).toBe('/api/v1/question-blocks/');
    expect(s.questionBlock(3)).toBe('/api/v1/question-blocks/3/');
    expect(s.questions).toBe('/api/v1/questions/');
    expect(s.question(9)).toBe('/api/v1/questions/9/');
    expect(s.reorderQuestionBlocks).toBe('/api/v1/question-blocks/reorder/');
    expect(s.reorderQuestions).toBe('/api/v1/questions/reorder/');
    expect(s.moveQuestion).toBe('/api/v1/questions/move/');
  });
  it('exposes survey-session actions', () => {
    expect(s.identify).toBe('/api/v1/survey-sessions/identify/');
    expect(s.due).toBe('/api/v1/survey-sessions/due/');
    expect(s.start).toBe('/api/v1/survey-sessions/start/');
    expect(s.submit(5)).toBe('/api/v1/survey-sessions/5/submit/');
    expect(s.adminFill).toBe('/api/v1/survey-sessions/admin-fill/');
    expect(s.results).toBe('/api/v1/survey-sessions/results/');
    expect(s.export).toBe('/api/v1/survey-sessions/export/');
  });
  it('keeps employees face-photo endpoints', () => {
    expect(API_ENDPOINTS.employees.facePhotos(2)).toBe('/api/v1/employees/2/face-photos/');
  });
});
