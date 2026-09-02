import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import type { AppConfig } from '../config/app-config';
import { normalizeBasePath } from '../config/base-path';
import { RuntimeConfigProvider } from './runtime-config-store';

type AppProvidersProps = PropsWithChildren<{
  config: AppConfig;
}>;

export function AppProviders({ children, config }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <RuntimeConfigProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider defaultColorScheme="light">
          <BrowserRouter basename={normalizeBasePath(config.basePath)}>{children}</BrowserRouter>
        </MantineProvider>
      </QueryClientProvider>
    </RuntimeConfigProvider>
  );
}
