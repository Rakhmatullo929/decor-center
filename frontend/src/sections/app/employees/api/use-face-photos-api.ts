import { useFetch, useMutate } from 'src/hooks/api';

import { addFacePhoto, deleteFacePhoto, fetchFacePhotos } from './face-photos-requests';
import type { FacePhoto } from './types';

/** Fetches the employee's face samples; only runs while the dialog is open. */
export function useFacePhotosQuery(employeeId: number | null, enabled: boolean) {
  return useFetch<FacePhoto[]>(
    ['employees', 'face-photos', employeeId],
    () => fetchFacePhotos(employeeId as number),
    { enabled: enabled && employeeId != null }
  );
}

export function useAddFacePhotoMutation() {
  // Per-file gate errors (no_face, duplicate, ...) are surfaced in the dialog,
  // so suppress the global error toast.
  return useMutate<FacePhoto, { employeeId: number; photo: File }>(
    ({ employeeId, photo }) => addFacePhoto(employeeId, photo),
    { skipGlobalErrorNotification: true }
  );
}

export function useDeleteFacePhotoMutation() {
  return useMutate<void, { employeeId: number; photoId: number }>(({ employeeId, photoId }) =>
    deleteFacePhoto(employeeId, photoId)
  );
}
