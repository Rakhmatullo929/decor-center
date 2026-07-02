import { request, API_ENDPOINTS } from 'src/utils/axios';

import type { FacePhoto } from './types';

/** List an employee's reference face samples (bare array, not paginated). */
export function fetchFacePhotos(employeeId: number) {
  return request<FacePhoto[]>({
    method: 'GET',
    url: API_ENDPOINTS.employees.facePhotos(employeeId),
  });
}

/**
 * Add one face sample. The backend gates one photo per request (single `photo`
 * field, multipart). FormData bypasses the snake_case transform, so the key is
 * appended as-is.
 */
export function addFacePhoto(employeeId: number, photo: File) {
  const formData = new FormData();
  formData.append('photo', photo);
  return request<FacePhoto>({
    method: 'POST',
    url: API_ENDPOINTS.employees.facePhotos(employeeId),
    data: formData,
  });
}

export function deleteFacePhoto(employeeId: number, photoId: number) {
  return request<void>({
    method: 'DELETE',
    url: API_ENDPOINTS.employees.facePhoto(employeeId, photoId),
  });
}
