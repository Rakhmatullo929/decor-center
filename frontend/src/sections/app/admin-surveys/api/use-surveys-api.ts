import { keepPreviousData } from '@tanstack/react-query';

import { useFetch, useFetchList, useMutate } from 'src/hooks/api';

import {
  createQuestion,
  createQuestionBlock,
  createTest,
  deleteQuestion,
  deleteQuestionBlock,
  deleteTest,
  exportSurveyResults,
  fetchQuestionBlocks,
  fetchQuestions,
  fetchSurveyResults,
  fetchTest,
  fetchTests,
  moveQuestion,
  reorderQuestionBlocks,
  reorderQuestions,
  updateQuestion,
  updateQuestionBlock,
  updateTest,
} from './surveys-requests';
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
  Test,
  TestListParams,
  TestUpsertPayload,
} from './types';

// ── Test detail (full tree: blocks + nested questions) ─────────────────
export function useTestQuery(testId: number) {
  return useFetch<Test>(['surveys', 'test', testId], () => fetchTest(testId), {
    enabled: Number.isFinite(testId),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────
export function useTestsQuery(params: TestListParams) {
  return useFetchList<Test>(['surveys', 'tests', params], () => fetchTests(params), {
    placeholderData: keepPreviousData,
  });
}
export function useTestOptionsQuery() {
  return useFetch(['surveys', 'testOptions'], () => fetchTests({ pageSize: 200, ordering: 'title' }));
}
export function useCreateTestMutation() {
  return useMutate<Test, TestUpsertPayload>((payload) => createTest(payload));
}
export function useUpdateTestMutation() {
  return useMutate<Test, { id: number; payload: Partial<TestUpsertPayload> }>(({ id, payload }) =>
    updateTest(id, payload)
  );
}
export function useDeleteTestMutation() {
  return useMutate<void, number>((id) => deleteTest(id));
}

// ── Question blocks ────────────────────────────────────────────────────
export function useQuestionBlocksQuery(testId: number) {
  return useFetchList<QuestionBlock>(
    ['surveys', 'blocks', testId],
    () => fetchQuestionBlocks(testId),
    { enabled: Number.isFinite(testId) }
  );
}
export function useCreateQuestionBlockMutation() {
  return useMutate<QuestionBlock, QuestionBlockUpsertPayload>((payload) =>
    createQuestionBlock(payload)
  );
}
export function useUpdateQuestionBlockMutation() {
  return useMutate<QuestionBlock, { id: number; payload: Partial<QuestionBlockUpsertPayload> }>(
    ({ id, payload }) => updateQuestionBlock(id, payload)
  );
}
export function useDeleteQuestionBlockMutation() {
  return useMutate<void, number>((id) => deleteQuestionBlock(id));
}
export function useReorderQuestionBlocksMutation() {
  return useMutate<QuestionBlock[], ReorderQuestionBlocksPayload>((payload) =>
    reorderQuestionBlocks(payload)
  );
}

// ── Questions ──────────────────────────────────────────────────────────
export function useQuestionsQuery(blockId: number) {
  return useFetchList<Question>(['surveys', 'questions', blockId], () => fetchQuestions(blockId), {
    enabled: Number.isFinite(blockId),
  });
}
export function useCreateQuestionMutation() {
  return useMutate<Question, QuestionUpsertPayload>((payload) => createQuestion(payload));
}
export function useUpdateQuestionMutation() {
  return useMutate<Question, { id: number; payload: Partial<QuestionUpsertPayload> }>(
    ({ id, payload }) => updateQuestion(id, payload)
  );
}
export function useDeleteQuestionMutation() {
  return useMutate<void, number>((id) => deleteQuestion(id));
}
export function useReorderQuestionsMutation() {
  return useMutate<Question[], ReorderQuestionsPayload>((payload) => reorderQuestions(payload));
}
export function useMoveQuestionMutation() {
  return useMutate<Question[], MoveQuestionPayload>((payload) => moveQuestion(payload));
}

// ── Results ────────────────────────────────────────────────────────────
export function useSurveyResultsQuery(params: ResultsParams | null) {
  return useFetch<SurveyResults>(
    ['surveys', 'results', params],
    () => fetchSurveyResults(params as ResultsParams),
    { enabled: params !== null }
  );
}
export function useExportSurveyResultsMutation() {
  return useMutate<Blob, ResultsExportParams>((params) => exportSurveyResults(params));
}
