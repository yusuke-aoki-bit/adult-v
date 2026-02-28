import { NextResponse } from 'next/server';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

export const revalidate = 3600; // 1時間キャッシュ

// hreflang用の言語バリエーション
function getHreflangLinks(path: string): string {
  const languages = [
    { lang: 'ja', suffix: '' },
    { lang: 'en', suffix: '?hl=en' },
    { lang: 'zh', suffix: '?hl=zh' },
    { lang: 'zh-TW', suffix: '?hl=zh-TW' },
    { lang: 'ko', suffix: '?hl=ko' },
    { lang: 'x-default', suffix: '' },
  ];

  return languages
    .map(
      ({ lang, suffix }) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}${path}${suffix}" />`,
    )
    .join('\n');
}

/**
 * 静的ページのサイトマップ
 */
export async function GET() {
  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/products', priority: '0.9', changefreq: 'daily' },
    { path: '/sales', priority: '0.9', changefreq: 'hourly' }, // セール情報は頻繁に更新
    { path: '/actresses', priority: '0.8', changefreq: 'daily' },
    { path: '/categories', priority: '0.8', changefreq: 'weekly' },
    { path: '/tags', priority: '0.8', changefreq: 'weekly' },
    { path: '/series', priority: '0.7', changefreq: 'weekly' },
    { path: '/makers', priority: '0.7', changefreq: 'weekly' },
    { path: '/rookies', priority: '0.7', changefreq: 'daily' },
    { path: '/hidden-gems', priority: '0.7', changefreq: 'daily' },
    { path: '/daily-pick', priority: '0.7', changefreq: 'daily' },
    { path: '/discover', priority: '0.6', changefreq: 'weekly' },
    { path: '/news', priority: '0.7', changefreq: 'daily' },
    { path: '/birthdays', priority: '0.6', changefreq: 'daily' },
    { path: '/calendar', priority: '0.6', changefreq: 'daily' },
    { path: `/best/${new Date().getFullYear() - 1}`, priority: '0.6', changefreq: 'monthly' },
    { path: '/privacy', priority: '0.3', changefreq: 'yearly', noHreflang: true },
    { path: '/terms', priority: '0.3', changefreq: 'yearly', noHreflang: true },
    { path: '/legal-compliance', priority: '0.3', changefreq: 'yearly', noHreflang: true },
  ];

  const today = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticPages
  .map(
    (page) => `  <url>
    <loc>${BASE_URL}${page.path}</loc>
${page.noHreflang ? '' : getHreflangLinks(page.path)}
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
