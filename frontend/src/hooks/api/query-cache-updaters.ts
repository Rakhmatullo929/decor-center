import type { InfiniteData } from '@tanstack/react-query';

import type { ModelType, Pagination } from './types';

export function addToList<Data extends ModelType>(item: Data) {
  return (old: Pagination<Data> | undefined): Pagination<Data> | undefined => {
    if (!old) {
      return old;
    }
    return {
      ...old,
      results: [...old.results, item],
      count: old.count + 1,
    };
  };
}

export function updateList<Data extends ModelType>(item: Data) {
  return (old: Pagination<Data> | undefined): Pagination<Data> | undefined => {
    if (!old) {
      return old;
    }
    return {
      ...old,
      results: old.results.map((row) => (row.id === item.id ? { ...row, ...item } : row)),
    };
  };
}

export function deleteFromList<Data extends ModelType>(id: string | number) {
  return (old: Pagination<Data> | undefined): Pagination<Data> | undefined => {
    if (!old) {
      return old;
    }
    return {
      ...old,
      results: old.results.filter((row) => row.id !== id),
      count: Math.max(0, old.count - 1),
    };
  };
}

export function updateObject<Data>(patch: Partial<Data>) {
  return (old: Data | undefined): Data | undefined => {
    if (!old) {
      return old as Data | undefined;
    }
    return { ...old, ...patch };
  };
}

export function addToInfinite<Data extends ModelType>(item: Data) {
  return (
    old: InfiniteData<Pagination<Data>> | undefined
  ): InfiniteData<Pagination<Data>> | undefined => {
    if (!old?.pages.length) {
      return old;
    }
    const pages = old.pages.map((page, index) =>
      index === 0
        ? { ...page, results: [item, ...page.results], count: page.count + 1 }
        : page
    );
    return { ...old, pages };
  };
}

export function updateInfinite<Data extends ModelType>(item: Data) {
  return (
    old: InfiniteData<Pagination<Data>> | undefined
  ): InfiniteData<Pagination<Data>> | undefined => {
    if (!old?.pages.length) {
      return old;
    }
    const pages = old.pages.map((page) => ({
      ...page,
      results: page.results.map((row) => (row.id === item.id ? { ...row, ...item } : row)),
    }));
    return { ...old, pages };
  };
}

export function deleteFromInfinite<Data extends ModelType>(id: string | number) {
  return (
    old: InfiniteData<Pagination<Data>> | undefined
  ): InfiniteData<Pagination<Data>> | undefined => {
    if (!old?.pages.length) {
      return old;
    }
    const pages = old.pages.map((page) => ({
      ...page,
      results: page.results.filter((row) => row.id !== id),
      count: page.results.some((row) => row.id === id) ? Math.max(0, page.count - 1) : page.count,
    }));
    return { ...old, pages };
  };
}
