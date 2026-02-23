import { NextResponse } from 'next/server';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://f.adult-v.com';

export const revalidate = 3600; // 1時間キャッシュ

// 女優チャンク数: 38,000人 ÷ 5,000 = 8チャンク
const ACTRESS_CHUNK_COUNT = 8;

/**
 * サイトマップインデックス - 大規模サイト対応
 * Googleの推奨: 1ファイル50,000URL以下、50MB以下
 * 分割することでクロール効率が向上
 */
export async function GET() {
  const sitemaps = [
    `${BASE_URL}/sitemap-static.xml`,
    `${BASE_URL}/sitemap-products-1.xml`,
    `${BASE_URL}/sitemap-products-2.xml`,
    // 女優チャンク（sitemap-actresses-0.xml ~ sitemap-actresses-7.xml）
    ...Array.from({ length: ACTRESS_CHUNK_COUNT }, (_, i) => `${BASE_URL}/sitemap-actresses-${i}.xml`),
    `${BASE_URL}/sitemap-tags.xml`,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (url) => `  <sitemap>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`,
  )
  .join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
