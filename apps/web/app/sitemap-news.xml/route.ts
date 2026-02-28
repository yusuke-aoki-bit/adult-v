import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
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
    .map(
      ({ lang, suffix }) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${BASE_URL}${path}${suffix}" />`,
    )
    .join('\n');
}

/**
 * ニュース記事のサイトマップ
 * 公開済み・未期限切れの記事をすべて掲載
 */
export async function GET() {
  try {
    const db = getDb();
    const result = await db.execute(sql`
      SELECT slug, published_at, updated_at
      FROM news_articles
      WHERE status = 'published'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY published_at DESC
      LIMIT 5000
    `);

    const articles = result.rows as Array<{
      slug: string;
      published_at: string;
      updated_at: string;
    }>;

    const urls = articles
      .map(
        (article) => `  <url>
    <loc>${BASE_URL}/news/${article.slug}</loc>
    <lastmod>${new Date(article.updated_at || article.published_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
${getHreflangLinks(`/news/${article.slug}`)}
  </url>`,
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[sitemap-news] Error:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      {
        headers: { 'Content-Type': 'application/xml' },
      },
    );
  }
}
