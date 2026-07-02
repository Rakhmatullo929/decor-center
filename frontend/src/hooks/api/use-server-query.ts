import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  type InfiniteData,
  type MutationFunction,
  type QueryFunction,
  type QueryKey,
  useInfiniteQuery,
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryOptions,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { useSnackbar } from 'src/components/snackbar';
import { paths } from 'src/routes/paths';
import { useAuthContext } from 'src/auth/hooks/use-auth-context';
import { errorReader } from 'src/utils/error-reader';

import { useIntersectionObserver } from 'src/hooks/use-intersection-observer';
import {
  addToInfinite,
  addToList,
  deleteFromInfinite,
  deleteFromList,
  updateInfinite,
  updateList,
  updateObject,
} from 'src/hooks/api/query-cache-updaters';
import type { BaseError, ModelType, Pagination } from './types';

export type { BaseError, ModelType, Pagination } from './types';

// ----------------------------------------------------------------------

function toBaseError(error: unknown): BaseError {
  if (axios.isAxiosError(error)) {
    return error as BaseError;
  }
  const synthetic = new Error(typeof error === 'string' ? error : 'Request failed') as BaseError;
  synthetic.response = undefined;
  return synthetic;
}

type QueryOptionsWithLegacyOnError<TQueryFnData> = Omit<
  UseQueryOptions<TQueryFnData, BaseError>,
  'queryKey' | 'queryFn'
> & {
  /** Optional extra handler (toasts still run via global error handler). */
  onError?: (err: BaseError) => void;
};

type InfiniteOptionsWithLegacyOnError<TQueryFnData, TPageParam> = Omit<
  UseInfiniteQueryOptions<TQueryFnData, BaseError, InfiniteData<TQueryFnData>, QueryKey, TPageParam>,
  'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
> & {
  onError?: (err: BaseError) => void;
};

type MutationOptionsWithLegacyOnError<TData, TVariables> = Omit<
  UseMutationOptions<TData, BaseError, TVariables>,
  'mutationFn'
> & {
  onError?: (err: BaseError, variables: TVariables, context: unknown) => void;
  /** Не вызывать глобальный snackbar/401-обработчик (форма покажет текст сама). */
  skipGlobalErrorNotification?: boolean;
};

function useQueryErrorNotify(
  isError: boolean,
  error: unknown,
  errorUpdatedAt: number,
  notify: (e: BaseError) => void
) {
  useEffect(() => {
    if (!isError || error == null) {
      return;
    }
    notify(toBaseError(error));
  }, [isError, error, errorUpdatedAt, notify]);
}

function isPublicAuthPath(pathname: string) {
  return pathname === '/login';
}

function useErrorHandler(onError?: (err: BaseError) => void) {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { logout } = useAuthContext();

  return useCallback(
    (error: BaseError) => {
      onError?.(error);

      if (error.response === undefined || error.response.status === 0) {
        enqueueSnackbar('Проверьте интернет соединение', { variant: 'error' });
        return;
      }

      const { status } = error.response;

      if (status >= 500) {
        enqueueSnackbar('Ошибка сервера.', { variant: 'error' });
        return;
      }

      if (status === 401) {
        // На экране входа 401 — неверные данные, а не «сессия истекла»
        if (isPublicAuthPath(location.pathname)) {
          enqueueSnackbar('Неверный номер телефона или пароль. Проверьте данные.', { variant: 'error' });
          return;
        }
        logout();
        queryClient.clear();
        navigate(paths.auth.jwt.login);
        return;
      }

      enqueueSnackbar(errorReader(error), { variant: 'error' });
    },
    [enqueueSnackbar, location.pathname, navigate, onError, queryClient, logout]
  );
}

export function useFetch<Data>(
  queryKey: QueryKey,
  queryFn: QueryFunction<Data>,
  options?: QueryOptionsWithLegacyOnError<Data>
) {
  const { onError: userOnError, ...queryOptions } = options ?? {};
  const handleError = useErrorHandler(userOnError);

  const result = useQuery<Data, BaseError>({
    queryKey,
    queryFn,
    ...queryOptions,
  });

  useQueryErrorNotify(result.isError, result.error, result.errorUpdatedAt, handleError);

  return result;
}

export function useFetchList<Data extends ModelType>(
  queryKey: QueryKey,
  queryFn: QueryFunction<Pagination<Data>>,
  options?: QueryOptionsWithLegacyOnError<Pagination<Data>>
) {
  const queryClient = useQueryClient();
  const result = useFetch(queryKey, queryFn, options);

  const addItem = useCallback(
    (item: Data) => {
      queryClient.setQueryData<Pagination<Data> | undefined>(queryKey, addToList(item));
    },
    [queryClient, queryKey]
  );

  const updateItem = useCallback(
    (item: Data) => {
      queryClient.setQueryData<Pagination<Data> | undefined>(queryKey, updateList(item));
    },
    [queryClient, queryKey]
  );

  const deleteItem = useCallback(
    (id: string | number) => {
      queryClient.setQueryData<Pagination<Data> | undefined>(queryKey, deleteFromList(id));
    },
    [queryClient, queryKey]
  );

  return { ...result, addItem, updateItem, deleteItem };
}

export function useFetchOne<Data>(
  queryKey: QueryKey,
  queryFn: QueryFunction<Data>,
  options?: QueryOptionsWithLegacyOnError<Data>
) {
  const queryClient = useQueryClient();
  const result = useFetch(queryKey, queryFn, options);

  const setData = useCallback(
    (patch: Partial<Data>) => {
      queryClient.setQueryData<Data | undefined>(queryKey, updateObject(patch));
    },
    [queryClient, queryKey]
  );

  return { ...result, setData };
}

export type InfinitePageFetcher<Data extends ModelType> = (args: {
  pageParam: number;
  signal: AbortSignal;
}) => Promise<Pagination<Data>>;

export function useInfiniteFetch<Data extends ModelType>(
  queryKey: QueryKey,
  queryFn: InfinitePageFetcher<Data>,
  options?: InfiniteOptionsWithLegacyOnError<Pagination<Data>, number>,
  pageSize = 50
) {
  const queryClient = useQueryClient();
  const { onError: userOnError, ...infiniteOptions } = options ?? {};
  const handleError = useErrorHandler(userOnError);

  const result = useInfiniteQuery<
    Pagination<Data>,
    BaseError,
    InfiniteData<Pagination<Data>>,
    QueryKey,
    number
  >({
    ...infiniteOptions,
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => queryFn({ pageParam, signal }),
    getNextPageParam: (lastPage, allPages) => {
      const maxPages = Math.ceil(lastPage.count / pageSize);
      const nextPage = allPages.length + 1;
      return nextPage <= maxPages ? nextPage : undefined;
    },
  });

  useQueryErrorNotify(result.isError, result.error, result.errorUpdatedAt, handleError);

  const observer = useIntersectionObserver({
    onIntersect: () => {
      result.fetchNextPage();
    },
    enabled: Boolean(result.hasNextPage && !result.isFetchingNextPage),
  });

  const addItem = useCallback(
    (item: Data) => {
      queryClient.setQueryData<InfiniteData<Pagination<Data>> | undefined>(queryKey, addToInfinite(item));
    },
    [queryClient, queryKey]
  );

  const updateItem = useCallback(
    (item: Data) => {
      queryClient.setQueryData<InfiniteData<Pagination<Data>> | undefined>(queryKey, updateInfinite(item));
    },
    [queryClient, queryKey]
  );

  const deleteItem = useCallback(
    (id: string | number) => {
      queryClient.setQueryData<InfiniteData<Pagination<Data>> | undefined>(queryKey, deleteFromInfinite(id));
    },
    [queryClient, queryKey]
  );

  return { observer, addItem, updateItem, deleteItem, ...result };
}

export function useMutate<Data, Variables>(
  mutationFn: MutationFunction<Data, Variables>,
  options?: MutationOptionsWithLegacyOnError<Data, Variables>
) {
  const { onError: userOnError, skipGlobalErrorNotification, ...mutationOptions } = options ?? {};
  const notify = useErrorHandler();

  return useMutation<Data, BaseError, Variables>({
    mutationFn,
    ...mutationOptions,
    onError: (err, variables, context) => {
      userOnError?.(err, variables, context);
      if (!skipGlobalErrorNotification) {
        notify(toBaseError(err));
      }
    },
  });
}

/** True while any query is refetching but no query is in initial pending state (background updates). */
export function useIsUpdating() {
  const initialLoadingCount = useIsFetching({
    predicate: (query) => query.state.status === 'pending',
  });
  const fetchingCount = useIsFetching();
  return fetchingCount > 0 && initialLoadingCount === 0;
}

export function useIsOnline() {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine
  );

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);

    window.addEventListener('online', online);
    window.addEventListener('offline', offline);

    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  return isOnline;
}
