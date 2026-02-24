import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tags, productTags, products } from '@/lib/db/schema';
import { desc, sql, eq } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://f.adult-v.com';

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
 * タグページのサイトマップ（ジャンル・メーカー・シリーズ）
 */
export async function GET() {
  if (!process.env.DATABASE_URL) {
    return new NextResponse('Database not configured', { status: 500 });
  }

  try {
    const db = getDb();

    // ジャンルタグ（上位1000件）
    const genreTags = await db
      .select({
        id: tags.id,
        category: tags.category,
        lastUpdated: sql<string>`MAX(${products.updatedAt})`.as('last_updated'),
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .leftJoin(products, eq(productTags.productId, products.id))
      .where(eq(tags.category, 'genre'))
      .groupBy(tags.id, tags.category)
      .orderBy(desc(sql`COUNT(DISTINCT ${productTags.productId})`))
      .limit(1000);

    // メーカータグ（上位500件）
    const makerTags = await db
      .select({
        id: tags.id,
        category: tags.category,
        lastUpdated: sql<string>`MAX(${products.updatedAt})`.as('last_updated'),
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .leftJoin(products, eq(productTags.productId, products.id))
      .where(eq(tags.category, 'maker'))
      .groupBy(tags.id, tags.category)
      .orderBy(desc(sql`COUNT(DISTINCT ${productTags.productId})`))
      .limit(500);

    // シリーズタグ（上位1000件）
    const seriesTags = await db
      .select({
        id: tags.id,
        category: tags.category,
        lastUpdated: sql<string>`MAX(${products.updatedAt})`.as('last_updated'),
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .leftJoin(products, eq(productTags.productId, products.id))
      .where(eq(tags.category, 'series'))
      .groupBy(tags.id, tags.category)
      .orderBy(desc(sql`COUNT(DISTINCT ${productTags.productId})`))
      .limit(1000);

    // カテゴリ別にURLパスを生成
    const allUrls = [
      ...genreTags.map((tag) => ({ path: `/tags/${tag.id}`, priority: '0.6', lastUpdated: tag.lastUpdated })),
      ...makerTags.map((tag) => ({ path: `/makers/${tag.id}`, priority: '0.6', lastUpdated: tag.lastUpdated })),
      ...seriesTags.map((tag) => ({ path: `/series/${tag.id}`, priority: '0.6', lastUpdated: tag.lastUpdated })),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allUrls
  .map(
    ({ path, priority, lastUpdated }) => `  <url>
    <loc>${BASE_URL}${path}</loc>
${getHreflangLinks(path)}
    <lastmod>${lastUpdated ? new Date(lastUpdated).toISOString() : new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
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
  } catch (error) {
    console.error('Error generating tags sitemap:', error);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}

export const revalidate = 3600; // 1時間キャッシュ
