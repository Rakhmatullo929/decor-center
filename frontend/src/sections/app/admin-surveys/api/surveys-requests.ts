import { request, API_ENDPOINTS } from 'src/utils/axios';
import type { Pagination } from 'src/hooks/api';

import type {
  Question,
  QuestionBlock,
  QuestionBlockUpsertPayload,
  QuestionUpsertPayload,
  ResultsExportParams,
  ResultsParams,
  SurveyResults,
  Test,
  TestListParams,
  TestUpsertPayload,
} from './types';

// ── Tests ──────────────────────────────────────────────────────────────
export function fetchTests(params: TestListParams) {
  return request<Pagination<Test>>({ method: 'GET', url: API_ENDPOINTS.surveys.tests, params });
}
export function createTest(payload: TestUpsertPayload) {
  return request<Test>({ method: 'POST', url: API_ENDPOINTS.surveys.tests, data: payload });
}
export function updateTest(id: number, payload: Partial<TestUpsertPayload>) {
  return request<Test>({ method: 'PATCH', url: API_ENDPOINTS.surveys.test(id), data: payload });
}
export function deleteTest(id: number) {
  return request<void>({ method: 'DELETE', url: API_ENDPOINTS.surveys.test(id) });
}

// ── Question blocks ────────────────────────────────────────────────────
export function fetchQuestionBlocks(testId: number) {
  return request<Pagination<QuestionBlock>>({
    method: 'GET',
    url: API_ENDPOINTS.surveys.questionBlocks,
    params: { test: testId, ordering: 'order', pageSize: 200 },
  });
}
export function createQuestionBlock(payload: QuestionBlockUpsertPayload) {
  return request<QuestionBlock>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.questionBlocks,
    data: payload,
  });
}
export function updateQuestionBlock(id: number, payload: Partial<QuestionBlockUpsertPayload>) {
  return request<QuestionBlock>({
    method: 'PATCH',
    url: API_ENDPOINTS.surveys.questionBlock(id),
    data: payload,
  });
}
export function deleteQuestionBlock(id: number) {
  return request<void>({ method: 'DELETE', url: API_ENDPOINTS.surveys.questionBlock(id) });
}

// ── Questions ──────────────────────────────────────────────────────────
export function fetchQuestions(blockId: number) {
  return request<Pagination<Question>>({
    method: 'GET',
    url: API_ENDPOINTS.surveys.questions,
    params: { block: blockId, ordering: 'order', pageSize: 200 },
  });
}
export function createQuestion(payload: QuestionUpsertPayload) {
  return request<Question>({ method: 'POST', url: API_ENDPOINTS.surveys.questions, data: payload });
}
export function updateQuestion(id: number, payload: Partial<QuestionUpsertPayload>) {
  return request<Question>({
    method: 'PATCH',
    url: API_ENDPOINTS.surveys.question(id),
    data: payload,
  });
}
export function deleteQuestion(id: number) {
  return request<void>({ method: 'DELETE', url: API_ENDPOINTS.surveys.question(id) });
}

// ── Results ────────────────────────────────────────────────────────────
export function fetchSurveyResults(params: ResultsParams) {
  return request<SurveyResults>({ method: 'GET', url: API_ENDPOINTS.surveys.results, params });
}
export function exportSurveyResults(params: ResultsExportParams) {
  return request<Blob>({
    method: 'GET',
    url: API_ENDPOINTS.surveys.export,
    params,
    responseType: 'blob',
  });
}
