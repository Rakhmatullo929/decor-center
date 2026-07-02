import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type Primitive = string | number | boolean;

export type UrlParamCodec<Value extends Primitive> = {
  defaultValue: Value;
  parse: (value: string | null) => Value;
  serialize: (value: unknown) => string | null;
};

export type UrlQuerySchema = Record<string, UrlParamCodec<Primitive>>;

type ValueFromCodec<T> = T extends UrlParamCodec<infer Value> ? Value : never;
type ValuesFromSchema<TSchema extends UrlQuerySchema> = {
  [Key in keyof TSchema]: ValueFromCodec<TSchema[Key]>;
};

export function stringParam(defaultValue = ''): UrlParamCodec<string> {
  return {
    defaultValue,
    parse: (value) => value ?? defaultValue,
    serialize: (value) => {
      if (typeof value !== 'string') {
        return defaultValue.length ? defaultValue : null;
      }
      const normalized = value.trim();
      return normalized.length ? normalized : null;
    },
  };
}

export function intParam(defaultValue: number, min = 1): UrlParamCodec<number> {
  return {
    defaultValue,
    parse: (value) => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < min) {
        return defaultValue;
      }
      return parsed;
    },
    serialize: (value) => {
      if (typeof value !== 'number') {
        return String(defaultValue);
      }
      if (!Number.isInteger(value) || value < min) {
        return String(defaultValue);
      }
      return String(value);
    },
  };
}

export function useUrlQueryState<TSchema extends UrlQuerySchema>(schema: TSchema) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const nextValues = {} as ValuesFromSchema<TSchema>;

    (Object.keys(schema) as Array<keyof TSchema>).forEach((key) => {
      const codec = schema[key];
      nextValues[key] = codec.parse(searchParams.get(String(key))) as ValuesFromSchema<TSchema>[typeof key];
    });

    return nextValues;
  }, [schema, searchParams]);

  const setValues = useCallback(
    (patch: Partial<ValuesFromSchema<TSchema>>, options?: { replace?: boolean }) => {
      const nextParams = new URLSearchParams(searchParams);

      (Object.keys(patch) as Array<keyof typeof patch>).forEach((key) => {
        const codec = schema[key as keyof TSchema];
        if (!codec) return;

        const nextValue = patch[key];
        if (typeof nextValue === 'undefined') return;

        const serialized = codec.serialize(nextValue);
        if (serialized === null) {
          nextParams.delete(String(key));
          return;
        }

        nextParams.set(String(key), serialized);
      });

      setSearchParams(nextParams, { replace: options?.replace ?? true });
    },
    [schema, searchParams, setSearchParams]
  );

  return { values, setValues };
}

type UseUrlListStateOptions = {
  pageKey?: string;
  pageSizeKey?: string;
  searchKey?: string;
  orderingKey?: string;
  defaultPage?: number;
  defaultPageSize?: number;
  defaultOrdering?: string;
};

export function useUrlListState(options?: UseUrlListStateOptions) {
  const {
    pageKey = 'page',
    pageSizeKey = 'page_size',
    searchKey = 'search',
    orderingKey = 'ordering',
    defaultPage = 1,
    defaultPageSize = 15,
    defaultOrdering = '-created_at',
  } = options ?? {};

  const schema = useMemo(
    () => ({
      [pageKey]: intParam(defaultPage),
      [pageSizeKey]: intParam(defaultPageSize),
      [orderingKey]: stringParam(defaultOrdering),
      [searchKey]: stringParam(''),
    }),
    [defaultOrdering, defaultPage, defaultPageSize, orderingKey, pageKey, pageSizeKey, searchKey]
  );

  const { values, setValues } = useUrlQueryState(schema);
  const page = values[pageKey] as number;
  const rowsPerPage = values[pageSizeKey] as number;
  const search = values[searchKey] as string;
  const ordering = values[orderingKey] as string;

  const setPage = useCallback(
    (nextPage: number) => {
      setValues({ [pageKey]: nextPage + 1 } as Partial<typeof values>);
    },
    [pageKey, setValues]
  );

  const setSearch = useCallback(
    (nextSearch: string) => {
      setValues({ [searchKey]: nextSearch, [pageKey]: 1 } as Partial<typeof values>);
    },
    [pageKey, searchKey, setValues]
  );

  const setRowsPerPage = useCallback(
    (nextRowsPerPage: number) => {
      setValues({ [pageSizeKey]: nextRowsPerPage, [pageKey]: 1 } as Partial<typeof values>);
    },
    [pageKey, pageSizeKey, setValues]
  );

  const setOrdering = useCallback(
    (nextOrdering: string) => {
      setValues({ [orderingKey]: nextOrdering, [pageKey]: 1 } as Partial<typeof values>);
    },
    [orderingKey, pageKey, setValues]
  );

  const handlePageChange = useCallback(
    (_event: unknown, newPage: number) => {
      setPage(newPage);
    },
    [setPage]
  );

  const handleRowsPerPageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextRowsPerPage = parseInt(event.target.value, 10);
      if (!Number.isInteger(nextRowsPerPage) || nextRowsPerPage <= 0) return;
      setRowsPerPage(nextRowsPerPage);
    },
    [setRowsPerPage]
  );

  return {
    page,
    rowsPerPage,
    search,
    ordering,
    values,
    setValues,
    setPage,
    setSearch,
    setRowsPerPage,
    setOrdering,
    handlePageChange,
    handleRowsPerPageChange,
  };
}

type UseSyncTableWithUrlListStateProps = {
  page: number;
  rowsPerPage: number;
  tablePage: number;
  tableRowsPerPage: number;
  setTablePage: (nextPage: number) => void;
  setTableRowsPerPage: (nextRowsPerPage: number) => void;
};

export function useSyncTableWithUrlListState({
  page,
  rowsPerPage,
  tablePage,
  tableRowsPerPage,
  setTablePage,
  setTableRowsPerPage,
}: UseSyncTableWithUrlListStateProps) {
  const pageZeroBased = Math.max(0, page - 1);

  useEffect(() => {
    if (tablePage !== pageZeroBased) {
      setTablePage(pageZeroBased);
    }
    if (tableRowsPerPage !== rowsPerPage) {
      setTableRowsPerPage(rowsPerPage);
    }
  }, [pageZeroBased, rowsPerPage, setTablePage, setTableRowsPerPage, tablePage, tableRowsPerPage]);
}
