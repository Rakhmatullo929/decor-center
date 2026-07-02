import { useCallback, useEffect, useRef, useState } from 'react';

// ----------------------------------------------------------------------

export type UseIntersectionObserverOptions = {
  onIntersect: () => void;
  enabled?: boolean;
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
};

/**
 * Attach returned `ref` to a sentinel; `onIntersect` runs when it enters the viewport.
 */
export function useIntersectionObserver({
  onIntersect,
  enabled = true,
  root = null,
  rootMargin = '0px',
  threshold = 0,
}: UseIntersectionObserverOptions) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const onIntersectRef = useRef(onIntersect);
  onIntersectRef.current = onIntersect;

  const ref = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!enabled || !node) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersectRef.current();
        }
      },
      { root, rootMargin, threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, node, root, rootMargin, threshold]);

  return { ref };
}
