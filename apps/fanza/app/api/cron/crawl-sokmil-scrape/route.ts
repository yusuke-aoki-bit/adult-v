/**
 * Sokmil スクレイピング クローラー API エンドポイント
 *
 * APIがダウンしている場合の代替としてWebサイトをスクレイピング
 * GET /api/cron/crawl-sokmil-scrape?page=1&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
  videosAdded: number;
}

interface SokmilProduct {
  itemId: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  sampleVideoUrl?: string;
  duration?: number;
  releaseDate?: string;
  price?: number;
  affiliateUrl: string;
}

const AFFILIATE_ID = '31819';

async function getProductIdsFromListPage(page: number): Promise<string[]> {
  const listUrl = `https://www.sokmil.com/av/list/?sort=date&page=${page}`;

  const response = await fetch(listUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) return [];

  const html = await response.text();
  const $ = cheerio.load(html);
  const productIds: string[] = [];

  $('a[href*="/av/_item/item"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/item(\d+)\.html/);
    if (match && !productIds.includes(match[1])) {
      productIds.push(match[1]);
    }
  });

  return productIds;
}

async function parseDetailPage(itemId: string): Promise<SokmilProduct | null> {
  const detailUrl = `https://www.sokmil.com/av/_item/item${itemId}.html`;

  try {
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  `Sokmil-${itemId}`;

    const description = $('meta[name="description"]').attr('content');

    const performers: string[] = [];
    $('a[href*="/actress/"], a[href*="actress_id="]').each((_, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 1 && name.length < 30 && !performers.includes(name) &&
          /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(name)) {
        performers.push(name);
      }
    });

    const thumbnailUrl = $('meta[property="og:image"]').attr('content');

    let duration: number | undefined;
    const durationMatch = $('body').text().match(/(\d+)\s*分/);
    if (durationMatch) duration = parseInt(durationMatch[1]);

    let releaseDate: string | undefined;
    const dateMatch = $('body').text().match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (dateMatch) releaseDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;

    let price: number | undefined;
    const priceMatch = $('body').text().match(/(\d{1,3}(?:,\d{3})*)\s*円/);
    if (priceMatch) price = parseInt(priceMatch[1].replace(/,/g, ''));

    let sampleVideoUrl: string | undefined;
    const videoMatch = html.match(/https?:\/\/[^"'\s]+\.mp4/i);
    if (videoMatch) sampleVideoUrl = videoMatch[0];

    return {
      itemId,
      title,
      description,
      performers,
      thumbnailUrl,
      sampleVideoUrl,
      duration,
      releaseDate,
      price,
      affiliateUrl: `https://www.sokmil.com/av/_item/item${itemId}.html?aff_id=${AFFILIATE_ID}`,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const db = getDb();
  const startTime = Date.now();
  const stats: CrawlStats = { totalFetched: 0, newProducts: 0, updatedProducts: 0, errors: 0, rawDataSaved: 0, videosAdded: 0 };

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const productIds = await getProductIdsFromListPage(page);
    if (productIds.length === 0) {
      return NextResponse.json({ success: true, message: 'No products found', stats, duration: '0s' });
    }

    for (const itemId of productIds.slice(0, limit)) {
      const product = await parseDetailPage(itemId);
      if (!product) { stats.errors++; continue; }

      stats.totalFetched++;

      try {
        const normalizedProductId = `sokmil-${product.itemId}`;
        const detailUrl = `https://www.sokmil.com/av/_item/item${product.itemId}.html`;
        const htmlResponse = await fetch(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await htmlResponse.text();
        const hash = createHash('sha256').update(html).digest('hex');

        await db.execute(sql`
          INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
          VALUES ('Sokmil', ${product.itemId}, ${detailUrl}, ${html}, ${hash})
          ON CONFLICT (source, product_id) DO UPDATE SET html_content = EXCLUDED.html_content, hash = EXCLUDED.hash, fetched_at = NOW()
        `);
        stats.rawDataSaved++;

        const productResult = await db.execute(sql`
          INSERT INTO products (normalized_product_id, title, description, release_date, duration, default_thumbnail_url, updated_at)
          VALUES (${normalizedProductId}, ${product.title}, ${product.description || null}, ${product.releaseDate ? new Date(product.releaseDate) : null}, ${product.duration || null}, ${product.thumbnailUrl || null}, NOW())
          ON CONFLICT (normalized_product_id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, release_date = EXCLUDED.release_date, duration = EXCLUDED.duration, default_thumbnail_url = EXCLUDED.default_thumbnail_url, updated_at = NOW()
          RETURNING id
        `);

        const productId = (productResult.rows[0] as { id: number }).id;
        if (productResult.rowCount === 1) stats.newProducts++; else stats.updatedProducts++;

        await db.execute(sql`
          INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url, price, data_source, last_updated)
          VALUES (${productId}, 'Sokmil', ${product.itemId}, ${product.affiliateUrl}, ${product.price || null}, 'CRAWL', NOW())
          ON CONFLICT (product_id, asp_name) DO UPDATE SET affiliate_url = EXCLUDED.affiliate_url, price = EXCLUDED.price, last_updated = NOW()
        `);

        for (const performerName of product.performers) {
          const performerResult = await db.execute(sql`INSERT INTO performers (name) VALUES (${performerName}) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
          await db.execute(sql`INSERT INTO product_performers (product_id, performer_id) VALUES (${productId}, ${(performerResult.rows[0] as { id: number }).id}) ON CONFLICT DO NOTHING`);
        }

        if (product.sampleVideoUrl) {
          const videoResult = await db.execute(sql`INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order) VALUES (${productId}, 'Sokmil', ${product.sampleVideoUrl}, 'sample', 0) ON CONFLICT DO NOTHING RETURNING id`);
          if (videoResult.rowCount && videoResult.rowCount > 0) stats.videosAdded++;
        }

        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        stats.errors++;
        console.error(`Error processing Sokmil ${product.itemId}:`, error);
      }
    }

    return NextResponse.json({ success: true, message: 'Sokmil scrape completed', params: { page, limit }, stats, duration: `${Math.round((Date.now() - startTime) / 1000)}s` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error', stats }, { status: 500 });
  }
}
