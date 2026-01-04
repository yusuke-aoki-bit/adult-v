import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.adult-v.com';

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
    .map(({ lang, suffix }) =>
      `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}${path}${suffix}" />`)
    .join('\n');
}

/**
 * 静的ページのサイトマップ
 */
export async function GET() {
  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/products', priority: '0.9', changefreq: 'daily' },
    { path: '/actresses', priority: '0.8', changefreq: 'daily' },
    { path: '/privacy', priority: '0.3', changefreq: 'yearly', noHreflang: true },
    { path: '/terms', priority: '0.3', changefreq: 'yearly', noHreflang: true },
    { path: '/legal-compliance', priority: '0.3', changefreq: 'yearly', noHreflang: true },
  ];

  const today = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticPages.map(page => `  <url>
    <loc>${BASE_URL}${page.path}</loc>
${page.noHreflang ? '' : getHreflangLinks(page.path)}
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
