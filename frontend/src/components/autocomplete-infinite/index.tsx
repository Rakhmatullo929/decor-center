import { createContext, forwardRef, useCallback, useContext, useMemo, useState } from 'react';

import Autocomplete, { type AutocompleteRenderInputParams, type AutocompleteRenderGetTagProps } from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import type { SxProps, Theme } from '@mui/material/styles';
import type { QueryKey } from '@tanstack/react-query';

import { useInfiniteFetch, type InfinitePageFetcher, type ModelType, type Pagination } from 'src/hooks/api';
import { useDebounce } from 'src/hooks/use-debounce';

// ---------------------------------------------------------------------------
// Context — gives the stable ListboxComponent access to scroll state without
// recreating it on every render (which would cause MUI to remount the listbox
// and discard scroll position / keyboard focus).
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

// Defined once at module level so MUI always receives the same component
// reference — otherwise MUI would unmount+remount the listbox on every render.
const InfiniteListbox = forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLElement>>(
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
InfiniteListbox.displayName = 'InfiniteListbox';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type AutocompleteInfiniteFetcher<T> = (params: {
  page: number;
  search: string;
  signal: AbortSignal;
}) => Promise<Pagination<T>>;

export type AutocompleteInfiniteProps<T extends ModelType> = {
  /** Prefix for the React Query key; the debounced search string is appended. */
  queryKeyBase: QueryKey;
  /** Called to fetch one page of results. */
  fetcher: AutocompleteInfiniteFetcher<T>;
  /** Must match the page size used inside `fetcher`. Defaults to 20. */
  pageSize?: number;
  value: T[];
  onChange: (value: T[]) => void;
  getOptionLabel: (option: T) => string;
  isOptionEqualToValue?: (option: T, value: T) => boolean;
  /** Custom row content inside the dropdown. Falls back to `getOptionLabel`. */
  renderOptionContent?: (option: T) => React.ReactNode;
  label?: string;
  placeholder?: string;
  /** Debounce delay in ms. Defaults to 400. */
  debounceMs?: number;
  disabled?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
  noOptionsText?: string;
  loadingText?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AutocompleteInfinite<T extends ModelType>({
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
  size,
  sx,
  noOptionsText,
  loadingText,
}: AutocompleteInfiniteProps<T>) {
  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebounce(inputValue, debounceMs);

  // A new key is built whenever debouncedSearch changes, which resets the
  // infinite query back to page 1 automatically.
  const queryKey = useMemo(
    () => [...(queryKeyBase as unknown[]), debouncedSearch] as QueryKey,
    [queryKeyBase, debouncedSearch]
  );

  const infiniteFetcher = useCallback<InfinitePageFetcher<T>>(
    ({ pageParam, signal }) => fetcher({ page: pageParam, search: debouncedSearch, signal }),
    // debouncedSearch is intentionally included: new search → new fetcher
    // → React Query creates a fresh query via the new key above.
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
      <Autocomplete<T, true, false, false>
        multiple
        options={options}
        value={value}
        onChange={(_event, newValue) => onChange(newValue)}
        inputValue={inputValue}
        onInputChange={(_event, newValue, reason) => {
          if (reason === 'input') {
            setInputValue(newValue);
          } else if (reason === 'reset') {
            // Fired after option selection — clear for fresh search.
            setInputValue('');
          }
        }}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={isOptionEqualToValue ?? ((a, b) => a.id === b.id)}
        filterOptions={(x) => x}
        disableCloseOnSelect
        loading={isPending}
        loadingText={loadingText}
        noOptionsText={noOptionsText}
        disabled={disabled}
        sx={sx}
        ListboxComponent={InfiniteListbox}
        renderTags={(tagValue: T[], getTagProps: AutocompleteRenderGetTagProps) =>
          tagValue.map((option, index) => (
            // getTagProps already supplies `key`; adding it separately causes TS2783.
            <Chip
              {...getTagProps({ index })}
              label={getOptionLabel(option)}
              size="small"
            />
          ))
        }
        renderOption={(props, option) => (
          <li {...props} key={String(option.id)}>
            {renderOptionContent ? renderOptionContent(option) : getOptionLabel(option)}
          </li>
        )}
        renderInput={(params: AutocompleteRenderInputParams) => (
          <TextField
            {...params}
            label={label}
            placeholder={value.length === 0 ? placeholder : undefined}
            size={size}
          />
        )}
      />
    </InfiniteScrollContext.Provider>
  );
}
