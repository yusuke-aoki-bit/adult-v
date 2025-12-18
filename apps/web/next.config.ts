import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createBaseNextConfig,
  createHeadersConfig,
  createI18nRedirects,
  createLegacyRedirects,
} from '@adult-v/shared/config/next-config-base';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../..');

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const baseConfig = createBaseNextConfig(monorepoRoot);

const nextConfig: NextConfig = {
  ...baseConfig,
  async headers() {
    return createHeadersConfig();
  },
  async redirects() {
    return [
      ...createI18nRedirects(),
      ...createLegacyRedirects(),
    ];
  },
};

export default withNextIntl(nextConfig);
