import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTheme, ThemeProvider } from '@mui/material/styles';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const theme = createTheme();

type CustomRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  /** Initial URL(s) for the MemoryRouter — list screens read state from the URL. */
  routerEntries?: string[];
};

function customRender(ui: React.ReactElement, options?: CustomRenderOptions) {
  const { routerEntries, ...renderOptions } = options ?? {};
  const queryClient = makeQueryClient();

  function AllProviders({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={routerEntries ?? ['/']}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: AllProviders, ...renderOptions });
}

export * from '@testing-library/react';
export { customRender as render };
