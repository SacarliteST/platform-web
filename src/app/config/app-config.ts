export type AppMode = 'standalone' | 'embedded';

export type AppConfig = {
  educationApiUrl: string;
  identityApiUrl?: string;
  basePath?: string;
  mode: AppMode;
};
