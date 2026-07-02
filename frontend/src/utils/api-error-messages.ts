import axios from 'axios';

import type { BaseError } from 'src/hooks/api/types';

import { errorReader } from './error-reader';

/**
 * User-facing copy for the JWT login form (Russian).
 */
export function getAuthFormErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error) {
      return error.message;
    }
    return typeof error === 'string' ? error : 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  }

  const status = error.response?.status;

  if (status === 401) {
    return 'Неверный логин или пароль. Проверьте данные и попробуйте снова.';
  }

  if (status === 400 || status === 403) {
    return errorReader(error as BaseError);
  }

  if (status === 404) {
    return 'Адрес API не найден. Проверьте настройки сервера.';
  }

  if (status === 429) {
    return 'Слишком много попыток. Подождите немного и попробуйте снова.';
  }

  if (status !== undefined && status >= 500) {
    return 'Ошибка на сервере. Попробуйте позже или напишите в поддержку.';
  }

  if (status === undefined || status === 0) {
    return 'Нет связи с сервером. Проверьте интернет и что backend запущен.';
  }

  return errorReader(error as BaseError);
}
