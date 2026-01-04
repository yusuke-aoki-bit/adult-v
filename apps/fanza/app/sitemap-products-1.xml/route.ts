import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://f.adult-v.com';
const PRODUCTS_PER_SITEMAP = 10000;

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
 * 商品ページのサイトマップ（1-10000）
 * 数値IDのみ（品番URLはcanonicalで対応、サイトマップからは除外）
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return new NextResponse('Database not configured', { status: 500 });
  }

  try {
    const db = getDb();

    // 最新の商品を取得（数値IDのみ）
    const recentProducts = await db
      .select({
        id: products.id,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .orderBy(desc(products.releaseDate))
      .limit(PRODUCTS_PER_SITEMAP)
      .offset(0);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${recentProducts.map(product => {
  const path = `/products/${product.id}`;
  const lastmod = product.updatedAt ? new Date(product.updatedAt).toISOString() : new Date().toISOString();
  return `  <url>
    <loc>${BASE_URL}${path}</loc>
${getHreflangLinks(path)}
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
}).join('\n')}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error generating products sitemap 1:', error);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}

export const revalidate = 3600; // 1時間キャッシュ
