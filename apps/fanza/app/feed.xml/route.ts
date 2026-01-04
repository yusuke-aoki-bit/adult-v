import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productSources, productPerformers, performers } from '@/lib/db/schema';
import { desc, sql, eq } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const SITE_NAME = 'FANZA VIEWER LAB';
const SITE_DESCRIPTION = 'FANZAの作品情報を整理し、ヘビー視聴者のための女優ベースの検索・比較サービス';

export const revalidate = 1800; // 30分キャッシュ

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();

    // 新着商品50件を取得（DTI除外）
    const recentProducts = await db
      .select({
        id: products.id,
        title: products.title,
        description: products.description,
        thumbnailUrl: products.defaultThumbnailUrl,
        releaseDate: products.releaseDate,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM ${productSources} ps
          WHERE ps.product_id = ${products.id}
          AND ps.asp_name = 'DTI'
        )`
      )
      .orderBy(desc(products.releaseDate))
      .limit(50);

    // 各商品の女優情報を取得
    const productsWithPerformers = await Promise.all(
      recentProducts.map(async (product) => {
        const productPerformerList = await db
          .select({
            name: performers.name,
          })
          .from(productPerformers)
          .innerJoin(performers, eq(productPerformers.performerId, performers.id))
          .where(eq(productPerformers.productId, product.id))
          .limit(5);

        return {
          ...product,
          performers: productPerformerList.map(p => p.name),
        };
      })
    );

    const lastBuildDate = new Date().toUTCString();
    const pubDate = recentProducts[0]?.releaseDate
      ? new Date(recentProducts[0].releaseDate).toUTCString()
      : lastBuildDate;

    // Generate RSS 2.0 feed
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_NAME)} - 新着動画</title>
    <link>${BASE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>ja</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <pubDate>${pubDate}</pubDate>
    <ttl>30</ttl>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/images/logo.png</url>
      <title>${escapeXml(SITE_NAME)}</title>
      <link>${BASE_URL}</link>
    </image>
${productsWithPerformers
  .map((product) => {
    const link = `${BASE_URL}/ja/products/${product.id}`;
    const pubDate = product.releaseDate
      ? new Date(product.releaseDate).toUTCString()
      : new Date(product.createdAt).toUTCString();

    const description = product.description
      ? escapeXml(product.description.substring(0, 300)) + '...'
      : '';

    const performersText = product.performers.length > 0
      ? ` | 出演: ${product.performers.join(', ')}`
      : '';

    const title = escapeXml(product.title + performersText);

    return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      ${product.thumbnailUrl ? `<media:thumbnail url="${escapeXml(product.thumbnailUrl)}" />
      <media:content url="${escapeXml(product.thumbnailUrl)}" type="image/jpeg" />` : ''}
      ${product.performers.map(p => `<dc:creator>${escapeXml(p)}</dc:creator>`).join('\n      ')}
    </item>`;
  })
  .join('\n')}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Error generating RSS feed', { status: 500 });
  }
}
