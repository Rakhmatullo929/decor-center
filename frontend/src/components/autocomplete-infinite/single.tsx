import { createContext, forwardRef, useCallback, useContext, useMemo, useState } from 'react';

import Autocomplete, {
  type AutocompleteRenderInputParams,
} from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import type { SxProps, Theme } from '@mui/material/styles';
import type { QueryKey } from '@tanstack/react-query';

import {
  useInfiniteFetch,
  type InfinitePageFetcher,
  type ModelType,
  type Pagination,
} from 'src/hooks/api';
import { useDebounce } from 'src/hooks/use-debounce';

// ---------------------------------------------------------------------------
// Stable module-level context + listbox — prevents MUI remounting on re-renders
// ---------------------------------------------------------------------------

type InfiniteScrollCtx = {
  sentinelRef: (el: HTMLElement | null) => void;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
};

const InfiniteScrollContext = createContext<InfiniteScrollCtx>({
  sentinelRef: () => {},
  isFetchingNextPage: false,
  hasNextPage: false,
});

const InfiniteListboxSingle = forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLElement>>(
  ({ children, ...props }, ref) => {
    const { sentinelRef, isFetchingNextPage, hasNextPage } = useContext(InfiniteScrollContext);
    return (
      <ul ref={ref} {...props}>
        {children}
        {hasNextPage && (
          <li
            ref={sentinelRef}
            style={{ listStyle: 'none', padding: '4px 0', textAlign: 'center' }}
          >
            {isFetchingNextPage && <CircularProgress size={18} />}
          </li>
        )}
      </ul>
    );
  }
);
InfiniteListboxSingle.displayName = 'InfiniteListboxSingle';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AutocompleteInfiniteSingleFetcher<T> = (params: {
  page: number;
  search: string;
  signal: AbortSignal;
}) => Promise<Pagination<T>>;

export type AutocompleteInfiniteSingleProps<T extends ModelType> = {
  queryKeyBase: QueryKey;
  fetcher: AutocompleteInfiniteSingleFetcher<T>;
  pageSize?: number;
  value: T | null;
  onChange: (value: T | null) => void;
  getOptionLabel: (option: T) => string;
  isOptionEqualToValue?: (option: T, value: T) => boolean;
  renderOptionContent?: (option: T) => React.ReactNode;
  label?: string;
  placeholder?: string;
  debounceMs?: number;
  disabled?: boolean;
  required?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
  noOptionsText?: string;
  loadingText?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AutocompleteInfiniteSingle<T extends ModelType>({
  queryKeyBase,
  fetcher,
  pageSize = 20,
  value,
  onChange,
  getOptionLabel,
  isOptionEqualToValue,
  renderOptionContent,
  label,
  placeholder,
  debounceMs = 400,
  disabled,
  required,
  size,
  sx,
  noOptionsText,
  loadingText,
}: AutocompleteInfiniteSingleProps<T>) {
  const [inputValue, setInputValue] = useState('');
  // Only send debounced search while the user is actively typing,
  // not after a selection (which would re-fetch with the option label).
  const [isTyping, setIsTyping] = useState(false);
  const debouncedSearch = useDebounce(isTyping ? inputValue : '', debounceMs);

  const queryKey = useMemo(
    () => [...(queryKeyBase as unknown[]), debouncedSearch] as QueryKey,
    [queryKeyBase, debouncedSearch]
  );

  const infiniteFetcher = useCallback<InfinitePageFetcher<T>>(
    ({ pageParam, signal }) => fetcher({ page: pageParam, search: debouncedSearch, signal }),
    [fetcher, debouncedSearch] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { data, isFetchingNextPage, hasNextPage, isPending, observer } = useInfiniteFetch<T>(
    queryKey,
    infiniteFetcher,
    {},
    pageSize
  );

  const options = useMemo<T[]>(
    () => data?.pages.flatMap((p) => p.results) ?? [],
    [data]
  );

  const ctxValue = useMemo<InfiniteScrollCtx>(
    () => ({
      sentinelRef: observer.ref,
      isFetchingNextPage,
      hasNextPage: Boolean(hasNextPage),
    }),
    [observer.ref, isFetchingNextPage, hasNextPage]
  );

  return (
    <InfiniteScrollContext.Provider value={ctxValue}>
      <Autocomplete<T, false, false, false>
        options={options}
        value={value}
        onChange={(_event, newValue) => onChange(newValue)}
        inputValue={inputValue}
        onInputChange={(_event, newValue, reason) => {
          setInputValue(newValue);
          setIsTyping(reason === 'input');
        }}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={isOptionEqualToValue ?? ((a, b) => a.id === b.id)}
        filterOptions={(x) => x}
        loading={isPending}
        loadingText={loadingText}
        noOptionsText={noOptionsText}
        disabled={disabled}
        sx={sx}
        ListboxComponent={InfiniteListboxSingle}
        renderOption={(props, option) => (
          <li {...props} key={String(option.id)}>
            {renderOptionContent ? renderOptionContent(option) : getOptionLabel(option)}
          </li>
        )}
        renderInput={(params: AutocompleteRenderInputParams) => (
          <TextField
            {...params}
            label={label}
            required={required}
            placeholder={value ? undefined : placeholder}
            size={size}
          />
        )}
      />
    </InfiniteScrollContext.Provider>
  );
}
