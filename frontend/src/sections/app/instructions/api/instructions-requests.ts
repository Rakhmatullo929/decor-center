import { request, API_ENDPOINTS } from 'src/utils/axios';
import type { Pagination } from 'src/hooks/api';

import type {
  GenerateQuestionsPayload,
  GenerateQuestionsResponse,
  Instruction,
  InstructionListParams,
  InstructionUploadPayload,
} from './types';

export function fetchInstructions(params: InstructionListParams) {
  return request<Pagination<Instruction>>({
    method: 'GET',
    url: API_ENDPOINTS.instructions.list,
    params,
  });
}

/**
 * File upload requires multipart. FormData bypasses the snake_case transform
 * in `apiClient`, so keys are appended in backend (snake_case) form here.
 */
export function createInstruction(payload: InstructionUploadPayload) {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('specialty', String(payload.specialty));
  formData.append('file', payload.file);

  return request<Instruction>({
    method: 'POST',
    url: API_ENDPOINTS.instructions.list,
    data: formData,
  });
}

export function deleteInstruction(id: number) {
  return request<void>({
    method: 'DELETE',
    url: API_ENDPOINTS.instructions.detail(id),
  });
}

/** Triggers an AI generation run; created questions land in the bank as drafts. */
export function generateInstructionQuestions(id: number, payload: GenerateQuestionsPayload) {
  return request<GenerateQuestionsResponse>({
    method: 'POST',
    url: API_ENDPOINTS.instructions.generate(id),
    data: payload,
  });
}
