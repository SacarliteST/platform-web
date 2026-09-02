import { createContext, useContext, useRef, type PropsWithChildren } from 'react';
import { createStore, useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { AppConfig } from '../config/app-config';

type RuntimeConfigState = {
  config: AppConfig;
};

type RuntimeConfigStore = StoreApi<RuntimeConfigState>;

const RuntimeConfigContext = createContext<RuntimeConfigStore | null>(null);

type RuntimeConfigProviderProps = PropsWithChildren<{
  config: AppConfig;
}>;

export function RuntimeConfigProvider({ children, config }: RuntimeConfigProviderProps) {
  const storeRef = useRef<RuntimeConfigStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createStore<RuntimeConfigState>(() => ({ config }));
  }

  return (
    <RuntimeConfigContext.Provider value={storeRef.current}>{children}</RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig(): AppConfig {
  const store = useContext(RuntimeConfigContext);

  if (!store) {
    throw new Error('useRuntimeConfig must be used within RuntimeConfigProvider');
  }

  return useStore(store, (state) => state.config);
}
