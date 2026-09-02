import { defineConfig } from 'orval';
import type { OpenApiDocument } from '@orval/core';

const identityTagNames: Record<string, string> = {
  Аудит: 'audit',
  Аутентификация: 'auth',
  Метаданные: 'discovery',
  Пользователи: 'users',
  Состояние: 'health',
};

const normalizeIdentityTags = (spec: OpenApiDocument): OpenApiDocument => {
  const paths = spec.paths ?? {};

  Object.values(paths).forEach((pathItem) => {
    if (!pathItem || typeof pathItem !== 'object') {
      return;
    }

    Object.values(pathItem).forEach((operation) => {
      if (!operation || typeof operation !== 'object' || !('tags' in operation)) {
        return;
      }

      const tags = operation.tags;

      if (!Array.isArray(tags)) {
        return;
      }

      operation.tags = tags.map((tag) => identityTagNames[tag] ?? tag);
    });
  });

  return {
    ...spec,
    tags: spec.tags?.map((tag) => ({
      ...tag,
      name: identityTagNames[tag.name] ?? tag.name,
    })),
  };
};

export default defineConfig({
  education: {
    input: {
      target: './education.swagger.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/api/education/index.ts',
      schemas: './src/api/education/model',
      client: 'react-query',
      httpClient: 'fetch',
      headers: true,
      clean: true,
      override: {
        mutator: {
          path: './src/shared/http/education-fetch.ts',
          name: 'educationFetch',
        },
      },
    },
  },
  identity: {
    input: {
      target: './identity.swagger.json',
      override: {
        transformer: normalizeIdentityTags,
      },
    },
    output: {
      mode: 'tags-split',
      target: './src/api/identity/index.ts',
      schemas: './src/api/identity/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: {
          path: './src/shared/http/identity-fetch.ts',
          name: 'identityFetch',
        },
      },
    },
  },
});
