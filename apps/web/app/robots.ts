import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/_next/',
          '/private/',
          // レガシーURL（ロケールなし）- 301リダイレクト済みだが念のためブロック
          '/categories',
          '/actress/',   // /actress/:id（ロケールなし）
          '/product/',   // /product/:id（ロケールなし）
          '/products/',  // /products/:id（ロケールなし、ルートのみ）
          '/age-verification',
        ],
      },
      // Specific rules for well-behaved bots
      {
        userAgent: ['Googlebot', 'Googlebot-Image'],
        allow: '/',
        disallow: ['/api/', '/admin/', '/private/', '/categories', '/actress/', '/product/', '/products/', '/age-verification'],
        crawlDelay: 0,
      },
      // Be more permissive with major search engines
      {
        userAgent: ['Bingbot', 'Slurp', 'DuckDuckBot'],
        allow: '/',
        disallow: ['/api/', '/admin/', '/private/', '/categories', '/actress/', '/product/', '/products/', '/age-verification'],
        crawlDelay: 1,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
