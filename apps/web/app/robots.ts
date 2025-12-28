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
          '/age-verification',
          // レガシーURL（/productsにリダイレクト済み）
          '/categories',
          '/categories/',
          // フィルターパラメータ付きURLを除外（重複コンテンツ防止）
          '/*?*include=',
          '/*?*exclude=',
          '/*?*hasVideo=',
          '/*?*hasImage=',
          '/*?*performerType=',
          '/*?*asp=',
          // ページネーションパラメータ付きURLを除外（sitemap以外からの発見を防ぐ）
          '/*?*page=',
          // ソートパラメータ付きURLを除外
          '/*?*sort=',
        ],
      },
      // Specific rules for well-behaved bots (Google)
      {
        userAgent: ['Googlebot', 'Googlebot-Image'],
        allow: [
          '/',
          '/*.js',
          '/*.css',
          '/*.png',
          '/*.jpg',
          '/*.webp',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/private/',
          '/age-verification',
          '/categories',
          '/categories/',
          '/*?*include=',
          '/*?*exclude=',
          '/*?*page=',
          '/*?*sort=',
        ],
      },
      // Bing, Yahoo, DuckDuckGo
      {
        userAgent: ['Bingbot', 'Slurp', 'DuckDuckBot'],
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/private/',
          '/age-verification',
          '/categories',
          '/categories/',
          '/*?*include=',
          '/*?*exclude=',
          '/*?*page=',
        ],
        crawlDelay: 1,
      },
      // Block aggressive SEO bots
      {
        userAgent: ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot'],
        disallow: '/',
      },
      // AI/LLM crawler rules - allow crawling for training data
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'Anthropic-AI', 'Claude-Web'],
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/private/',
          '/age-verification',
        ],
        crawlDelay: 2,
      },
      // Block other aggressive AI scrapers
      {
        userAgent: ['CCBot', 'FacebookBot', 'Bytespider'],
        disallow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
