import type { AppConfig } from './app-config';

type StandaloneRuntimeConfig = Partial<
  Pick<AppConfig, 'educationApiUrl' | 'identityApiUrl' | 'basePath'>
>;

const runtimeConfigUrl = '/runtime-config.json';

function readEnvConfig(): AppConfig {
  return {
    educationApiUrl: import.meta.env.VITE_EDUCATION_API_URL ?? 'http://localhost:5135',
    identityApiUrl: import.meta.env.VITE_IDENTITY_API_URL ?? 'http://localhost:5101',
    basePath: import.meta.env.VITE_BASE_PATH ?? '/',
    mode: 'standalone',
  };
}

async function readRuntimeConfig(): Promise<StandaloneRuntimeConfig> {
  try {
    const response = await fetch(runtimeConfigUrl, { cache: 'no-store' });

    if (!response.ok) {
      return {};
    }

    return (await response.json()) as StandaloneRuntimeConfig;
  } catch {
    return {};
  }
}

export async function readStandaloneConfig(): Promise<AppConfig> {
  const envConfig = readEnvConfig();
  const runtimeConfig = await readRuntimeConfig();

  return {
    ...envConfig,
    ...runtimeConfig,
    educationApiUrl: runtimeConfig.educationApiUrl ?? envConfig.educationApiUrl,
    mode: 'standalone',
  };
}
