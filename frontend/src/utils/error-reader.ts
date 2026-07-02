import axios from 'axios';

import type { BaseError } from 'src/hooks/api/types';

function pickDetail(data: Record<string, unknown>): string | null {
  const { detail } = data;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail.map(String).join(', ');
  }
  const firstKey = Object.keys(data)[0];
  if (!firstKey) {
    return null;
  }
  const val = data[firstKey];
  if (typeof val === 'string') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(String).join(', ');
  }
  return null;
}

/** Human-readable message for snackbars / forms (DRF + axios). */
export function errorReader(error: BaseError | unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const msg = pickDetail(data as Record<string, unknown>);
      if (msg) {
        return msg;
      }
    }
    if (typeof data === 'string' && data) {
      return data;
    }
    return error.message || 'Ошибка запроса';
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Не удалось выполнить запрос';
}
