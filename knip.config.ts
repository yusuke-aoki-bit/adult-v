import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: ['scripts/**/*.ts', 'scripts/**/*.mjs'],
      ignoreDependencies: ['eslint-config-next', '@eslint/eslintrc'],
    },
    'apps/web': {
      entry: [
        'app/**/page.tsx',
        'app/**/layout.tsx',
        'app/**/loading.tsx',
        'app/**/error.tsx',
        'app/**/not-found.tsx',
        'app/**/global-error.tsx',
        'app/**/route.ts',
        'i18n.ts',
        'components/**/*.tsx',
      ],
      project: ['**/*.{ts,tsx}'],
      ignore: ['eslint.config.mjs'],
      ignoreDependencies: ['sharp'],
      eslint: false,
      next: true,
    },
    'apps/fanza': {
      entry: [
        'app/**/page.tsx',
        'app/**/layout.tsx',
        'app/**/loading.tsx',
        'app/**/error.tsx',
        'app/**/not-found.tsx',
        'app/**/global-error.tsx',
        'app/**/route.ts',
        'i18n.ts',
        'components/**/*.tsx',
      ],
      project: ['**/*.{ts,tsx}'],
      ignore: ['eslint.config.mjs'],
      ignoreDependencies: ['sharp'],
      eslint: false,
      next: true,
    },
    'packages/shared': {
      entry: ['src/index.ts', 'src/**/*.tsx', 'src/**/*.ts'],
      project: ['src/**/*.{ts,tsx}'],
      includeEntryExports: false,
    },
    'packages/database': {
      project: ['src/**/*.ts'],
    },
    'packages/crawlers': {
      entry: ['src/**/*.ts'],
      project: ['src/**/*.ts'],
    },
  },
};

export default config;
