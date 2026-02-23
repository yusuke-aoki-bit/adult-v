/**
 * Root ESLint config for lint-staged.
 * App-specific configs are in apps/web/ and apps/fanza/.
 * This config handles files at root and in packages/.
 */
export default [
  {
    ignores: [
      'apps/**',
      'node_modules/**',
      '.next/**',
      'drizzle/**',
      'cloud-build/**',
      'scripts/**',
      '**/*.js',
      '**/*.cjs',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mjs'],
    rules: {},
  },
];
