import { keepPreviousData } from '@tanstack/react-query';

import { useFetchList, useMutate } from 'src/hooks/api';

import {
  approveQuestion,
  createQuestion,
  deleteQuestion,
  fetchQuestions,
  updateQuestion,
} from './questions-requests';
import type { Question, QuestionListParams, QuestionUpsertPayload } from './types';

export function useQuestionsQuery(params: QuestionListParams) {
  return useFetchList<Question>(['questions', 'list', params], () => fetchQuestions(params), {
    placeholderData: keepPreviousData,
  });
}

export function useCreateQuestionMutation() {
  return useMutate<Question, QuestionUpsertPayload>((payload) => createQuestion(payload), {
    // Backend field errors (e.g. specialty/module mismatch) are rendered inside the form.
    skipGlobalErrorNotification: true,
  });
}

export function useUpdateQuestionMutation() {
  return useMutate<Question, { id: number; payload: Partial<QuestionUpsertPayload> }>(
    ({ id, payload }) => updateQuestion(id, payload),
    {
      skipGlobalErrorNotification: true,
    }
  );
}

/** Approve from the list — global error toast is fine here. */
export function useApproveQuestionMutation() {
  return useMutate<Question, number>((id) => approveQuestion(id));
}

export function useDeleteQuestionMutation() {
  return useMutate<void, number>((id) => deleteQuestion(id));
}
