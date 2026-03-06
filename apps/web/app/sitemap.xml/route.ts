import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productSources } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

export const revalidate = 3600; // 1時間キャッシュ

// 女優チャンク数: 38,000人 ÷ 5,000 = 8チャンク
const ACTRESS_CHUNK_COUNT = 8;
const PRODUCT_CHUNK_SIZE = 10000;

/**
 * サイトマップインデックス - 大規模サイト対応
 * Googleの推奨: 1ファイル50,000URL以下、50MB以下
 * 分割することでクロール効率が向上
 */
export async function GET() {
  // 商品数からチャンク数を動的に算出（DTI除外）
  let productChunkCount = 2; // フォールバック
  try {
    const db = getDb();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM ${productSources} ps
          WHERE ps.product_id = ${products.id}
          AND ps.asp_name = 'DTI'
        )`,
      );
    const totalProducts = Number(result[0]?.count || 0);
    productChunkCount = Math.max(1, Math.ceil(totalProducts / PRODUCT_CHUNK_SIZE));
  } catch {
    // DB接続失敗時はフォールバック
  }

  // DB最新更新日を取得（動的コンテンツのlastmodに使用）
  let lastProductUpdate = new Date().toISOString();
  try {
    const db = getDb();
    const lastUpdate = await db.select({ maxDate: sql<string>`MAX(updated_at)` }).from(products);
    if (lastUpdate[0]?.maxDate) {
      lastProductUpdate = new Date(lastUpdate[0].maxDate).toISOString();
    }
  } catch {
    // DB接続失敗時はフォールバック
  }

  const sitemaps: { url: string; lastmod: string }[] = [
    { url: `${BASE_URL}/sitemap-static.xml`, lastmod: lastProductUpdate },
    // 商品チャンク（動的に算出）
    ...Array.from({ length: productChunkCount }, (_, i) => ({
      url: `${BASE_URL}/sitemap-products-${i}.xml`,
      lastmod: lastProductUpdate,
    })),
    // 女優チャンク（sitemap-actresses-0.xml ~ sitemap-actresses-7.xml）
    ...Array.from({ length: ACTRESS_CHUNK_COUNT }, (_, i) => ({
      url: `${BASE_URL}/sitemap-actresses-${i}.xml`,
      lastmod: lastProductUpdate,
    })),
    { url: `${BASE_URL}/sitemap-tags.xml`, lastmod: lastProductUpdate },
    { url: `${BASE_URL}/sitemap-series.xml`, lastmod: lastProductUpdate },
    { url: `${BASE_URL}/sitemap-makers.xml`, lastmod: lastProductUpdate },
    { url: `${BASE_URL}/sitemap-news.xml`, lastmod: lastProductUpdate },
    { url: `${BASE_URL}/sitemap-videos.xml`, lastmod: lastProductUpdate },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    ({ url, lastmod }) => `  <sitemap>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
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
