import { MetadataRoute } from 'next';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

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
          // 言語プレフィックスは許可（hreflangで適切に設定）
          // 重複コンテンツはcanonicalタグで制御
          // 複合フィルターパラメータのみ除外（探索的クロールを許可しつつ重複を防止）
          '/*?*include=*&*exclude=',
          // ページネーション・ソートは許可（noindex/canonicalで制御）
          // シンプルなフィルターは許可（ユーザーの検索経路を確保）
        ],
      },
      // Specific rules for well-behaved bots (Google)
      {
        userAgent: ['Googlebot', 'Googlebot-Image'],
        allow: ['/', '/*.js', '/*.css', '/*.png', '/*.jpg', '/*.webp'],
        disallow: [
          '/api/',
          '/admin/',
          '/private/',
          '/age-verification',
          // 複合フィルターのみ除外
          '/*?*include=*&*exclude=',
        ],
      },
      // Bing, Yahoo, DuckDuckGo
      {
        userAgent: ['Bingbot', 'Slurp', 'DuckDuckBot'],
        allow: '/',
        disallow: ['/api/', '/admin/', '/private/', '/age-verification', '/*?*include=*&*exclude='],
        crawlDelay: 1,
      },
      // Baidu (中国) - 簡体字中国語コンテンツの検索対応
      {
        userAgent: 'Baiduspider',
        allow: '/',
        disallow: ['/api/', '/admin/', '/private/', '/age-verification', '/*?*include=*&*exclude='],
        crawlDelay: 0.5,
      },
      // Naver (韓国) - 韓国語コンテンツの検索対応
      {
        userAgent: 'Naverbot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/private/', '/age-verification', '/*?*include=*&*exclude='],
        crawlDelay: 1,
      },
      // Yandex (ロシア) - ロシア語圏の検索対応
      {
        userAgent: 'YandexBot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/private/', '/age-verification', '/*?*include=*&*exclude='],
        crawlDelay: 1,
      },
      // Block aggressive SEO bots
      {
        userAgent: ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot'],
        disallow: '/',
      },
      // AI/LLM crawler rules - allow crawling with rate limit
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'Anthropic-AI', 'Claude-Web'],
        allow: '/',
        disallow: ['/api/', '/admin/', '/private/', '/age-verification', '/*?*'],
        crawlDelay: 5,
      },
      // Block aggressive AI scrapers
      {
        userAgent: ['CCBot', 'FacebookBot', 'Bytespider', 'PerplexityBot', 'Applebot-Extended'],
        disallow: '/',
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
