import '@testing-library/jest-dom';

// ── jsdom polyfills for browser APIs used by MUI / simplebar / file downloads ──

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

if (typeof window !== 'undefined') {
  window.ResizeObserver = window.ResizeObserver || (ResizeObserverMock as never);

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as never;
  }

  window.URL.createObjectURL = window.URL.createObjectURL || (() => 'blob:mock');
  window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});

  window.scrollTo = window.scrollTo || (() => {});
}
