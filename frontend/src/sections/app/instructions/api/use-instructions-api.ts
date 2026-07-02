import { keepPreviousData } from '@tanstack/react-query';

import { useFetchList, useMutate } from 'src/hooks/api';

import {
  createInstruction,
  deleteInstruction,
  fetchInstructions,
  generateInstructionQuestions,
} from './instructions-requests';
import type {
  GenerateQuestionsPayload,
  GenerateQuestionsResponse,
  Instruction,
  InstructionListParams,
  InstructionUploadPayload,
} from './types';

export function useInstructionsQuery(params: InstructionListParams) {
  return useFetchList<Instruction>(
    ['instructions', 'list', params],
    () => fetchInstructions(params),
    {
      placeholderData: keepPreviousData,
    }
  );
}

export function useCreateInstructionMutation() {
  return useMutate<Instruction, InstructionUploadPayload>((payload) => createInstruction(payload), {
    // File validation errors (extension, size) are rendered inside the form.
    skipGlobalErrorNotification: true,
  });
}

export function useDeleteInstructionMutation() {
  return useMutate<void, number>((id) => deleteInstruction(id));
}

/** AI generation run — server-side status fields change, caller invalidates caches. */
export function useGenerateQuestionsMutation() {
  return useMutate<GenerateQuestionsResponse, { id: number; payload: GenerateQuestionsPayload }>(
    ({ id, payload }) => generateInstructionQuestions(id, payload)
  );
}
