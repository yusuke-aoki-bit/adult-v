import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { tags, productTags } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

export const revalidate = 3600; // 1時間キャッシュ

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
 * メーカー/レーベル個別ページのサイトマップ
 * tags テーブルの category IN ('maker', 'label') から取得
 */
export async function GET() {
  if (!process.env['DATABASE_URL']) {
    return new NextResponse('Database not configured', { status: 500 });
  }

  try {
    const db = getDb();

    const makerList = await db.execute(sql`
      SELECT t.id, MAX(p.updated_at) as last_updated
      FROM ${tags} t
      JOIN ${productTags} pt ON t.id = pt.tag_id
      JOIN products p ON pt.product_id = p.id
      WHERE t.category IN ('maker', 'label')
      GROUP BY t.id
      HAVING COUNT(DISTINCT pt.product_id) >= 2
      ORDER BY COUNT(DISTINCT pt.product_id) DESC
      LIMIT 50000
    `);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${(makerList.rows || []).map((row: Record<string, unknown>) => {
  const path = `/makers/${row['id']}`;
  const lastmod = row['last_updated'] ? new Date(String(row['last_updated'])).toISOString() : new Date().toISOString();
  return `  <url>
    <loc>${BASE_URL}${path}</loc>
${getHreflangLinks(path)}
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
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
    console.error('Error generating makers sitemap:', error);
    return new NextResponse('Error generating makers sitemap', { status: 500 });
  }
}
