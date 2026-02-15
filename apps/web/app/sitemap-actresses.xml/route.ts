import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { performers, productPerformers } from '@/lib/db/schema';
import { desc, sql, eq } from 'drizzle-orm';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

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
 * 女優ページのサイトマップ（レガシー）
 * sitemap-actresses-[chunk].xml に移行済み
 * このエンドポイントはチャンク版サイトマップインデックスへリダイレクト
 */
export async function GET() {
  const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

  // チャンク版サイトマップを使用するよう、サイトマップインデックスにリダイレクト
  // 旧URLにアクセスがあった場合の後方互換性を維持
  return NextResponse.redirect(`${BASE_URL}/sitemap.xml`, 301);
}

/**
 * @deprecated このエンドポイントは廃止予定です。
 * sitemap-actresses-[chunk].xml を使用してください。
 */
async function _legacyGetAllActresses() {
  if (!process.env['DATABASE_URL']) {
    return null;
  }

  try {
    const db = getDb();

    // 作品数の多い女優を取得（レガシー参照用）
    const topPerformers = await db
      .select({
        id: performers.id,
        createdAt: performers.createdAt,
      })
      .from(performers)
      .leftJoin(productPerformers, eq(performers.id, productPerformers.performerId))
      .groupBy(performers.id, performers.createdAt)
      .orderBy(desc(sql`COUNT(DISTINCT ${productPerformers.productId})`))
      .limit(50000); // 制限を大幅に緩和（全女優対応）

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${topPerformers.map(performer => {
  const path = `/actress/${performer.id}`;
  const lastmod = performer.createdAt ? new Date(performer.createdAt).toISOString() : new Date().toISOString();
  return `  <url>
    <loc>${BASE_URL}${path}</loc>
${getHreflangLinks(path)}
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
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
    console.error('Error generating actresses sitemap:', error);
    return new NextResponse('Error generating sitemap', { status: 500 });
  }
}

export const revalidate = 3600; // 1時間キャッシュ
