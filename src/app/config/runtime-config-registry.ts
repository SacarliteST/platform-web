import type { AppConfig } from './app-config';

let runtimeConfig: AppConfig | null = null;

export function setRuntimeConfig(config: AppConfig): void {
  runtimeConfig = config;
}

export function getRuntimeConfig(): AppConfig {
  if (!runtimeConfig) {
    throw new Error('Runtime config has not been initialized');
  }

  return runtimeConfig;
}
