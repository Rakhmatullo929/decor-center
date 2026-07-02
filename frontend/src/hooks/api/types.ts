import type { AxiosError } from 'axios';

/** Entity with id (UUID string from Django or numeric id). */
export type ModelType = { id: string | number };

/** DRF-style paginated list (keys camelized by `apiClient`). */
export type Pagination<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ServerErrorBody = Record<string, unknown> | string | string[];

export type BaseError = AxiosError<ServerErrorBody>;
