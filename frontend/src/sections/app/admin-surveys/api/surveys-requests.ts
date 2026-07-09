import { request, API_ENDPOINTS } from 'src/utils/axios';
import type { Pagination } from 'src/hooks/api';

import type {
  MoveQuestionPayload,
  Question,
  QuestionBlock,
  QuestionBlockUpsertPayload,
  QuestionUpsertPayload,
  ReorderQuestionBlocksPayload,
  ReorderQuestionsPayload,
  ResultsExportParams,
  ResultsParams,
  SurveyResults,
  SurveySessionAdmin,
  SurveySessionListParams,
  Test,
  TestListParams,
} from './types';

// ── Tests ──────────────────────────────────────────────────────────────
// Read-only: surveys are created/edited/deleted on the backend (seeds/admin),
// not through this frontend.
export function fetchTests(params: TestListParams) {
  return request<Pagination<Test>>({ method: 'GET', url: API_ENDPOINTS.surveys.tests, params });
}
export function fetchTest(id: number) {
  return request<Test>({ method: 'GET', url: API_ENDPOINTS.surveys.test(id) });
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
export function reorderQuestionBlocks(payload: ReorderQuestionBlocksPayload) {
  return request<QuestionBlock[]>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.reorderQuestionBlocks,
    data: payload,
  });
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
export function reorderQuestions(payload: ReorderQuestionsPayload) {
  return request<Question[]>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.reorderQuestions,
    data: payload,
  });
}
export function moveQuestion(payload: MoveQuestionPayload) {
  return request<Question[]>({
    method: 'POST',
    url: API_ENDPOINTS.surveys.moveQuestion,
    data: payload,
  });
}

// ── Sessions (who started/is in progress/completed/abandoned a test) ────
// DefaultPagination caps page_size at 100 server-side, so a single request can silently
// truncate once a test has more sessions than that — loop pages until all are fetched.
export async function fetchSurveySessions(
  params: SurveySessionListParams
): Promise<SurveySessionAdmin[]> {
  const pageSize = 100;
  let page = 1;
  const all: SurveySessionAdmin[] = [];
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const result = await request<Pagination<SurveySessionAdmin>>({
      method: 'GET',
      url: API_ENDPOINTS.surveys.sessions,
      params: { ...params, page, pageSize, ordering: '-started_at' },
    });
    all.push(...result.results);
    if (!result.next || all.length >= result.count) break;
    page += 1;
  }
  return all;
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
