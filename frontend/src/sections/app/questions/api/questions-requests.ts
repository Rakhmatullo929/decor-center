import { request, API_ENDPOINTS } from 'src/utils/axios';
import type { Pagination } from 'src/hooks/api';

import type { Question, QuestionListParams, QuestionUpsertPayload } from './types';

export function fetchQuestions(params: QuestionListParams) {
  return request<Pagination<Question>>({
    method: 'GET',
    url: API_ENDPOINTS.questions.list,
    params,
  });
}

export function createQuestion(payload: QuestionUpsertPayload) {
  return request<Question>({
    method: 'POST',
    url: API_ENDPOINTS.questions.list,
    data: payload,
  });
}

export function updateQuestion(id: number, payload: Partial<QuestionUpsertPayload>) {
  return request<Question>({
    method: 'PATCH',
    url: API_ENDPOINTS.questions.detail(id),
    data: payload,
  });
}

/** Returns the updated question with `status: 'approved'`. */
export function approveQuestion(id: number) {
  return request<Question>({
    method: 'POST',
    url: API_ENDPOINTS.questions.approve(id),
  });
}

export function deleteQuestion(id: number) {
  return request<void>({
    method: 'DELETE',
    url: API_ENDPOINTS.questions.detail(id),
  });
}
