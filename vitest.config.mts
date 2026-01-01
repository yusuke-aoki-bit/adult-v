import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'e2e/**',
      '.next/**',
      '__tests__/legacy/**',
    ],
    // Increase timeout for tests that use dynamic imports (slower on Windows)
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'coverage/',
        '**/*.config.*',
        'vitest.setup.ts',
        'e2e/',
      ],
    },
    deps: {
      // Handle packages that need to be transformed
      optimizer: {
        web: {
          include: ['@adult-v/shared'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@adult-v/shared': path.resolve(__dirname, './packages/shared/src'),
      '@adult-v/ui-common': path.resolve(__dirname, './packages/ui-common/src'),
      '@adult-v/database': path.resolve(__dirname, './packages/database/src'),
      // Mock Next.js modules
      'next/link': path.resolve(__dirname, './__mocks__/next/link.tsx'),
      'next/image': path.resolve(__dirname, './__mocks__/next/image.tsx'),
      'next/navigation': path.resolve(__dirname, './__mocks__/next/navigation.ts'),
      'next-intl': path.resolve(__dirname, './__mocks__/next-intl.ts'),
    },
  },
});
