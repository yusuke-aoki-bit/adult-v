/**
 * Sokmil スクレイピング クローラー ハンドラー
 *
 * APIがダウンしている場合の代替としてWebサイトをスクレイピング
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import type { DbExecutor } from '../db-queries/types';
import {
  batchUpsertPerformers,
  batchInsertProductPerformers,
} from '../utils/batch-db';

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

const FETCH_TIMEOUT = 15_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getProductIdsFromListPage(page: number): Promise<string[]> {
  const listUrl = `https://www.sokmil.com/av/list/?sort=date&page=${page}`;

  const response = await fetchWithTimeout(listUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) return [];

  const html = await response['text']();
  const $ = cheerio.load(html);
  const productIds: string[] = [];

  $('a[href*="/av/_item/item"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/item(\d+)\.html/);
    if (match?.[1] && !productIds.includes(match[1])) {
      productIds.push(match[1]);
    }
  });

  return productIds;
}

async function parseDetailPage(itemId: string): Promise<(SokmilProduct & { rawHtml: string }) | null> {
  const detailUrl = `https://www.sokmil.com/av/_item/item${itemId}.html`;

  try {
    const response = await fetchWithTimeout(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return null;

    const html = await response['text']();
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

    // 収録時間: 「収録時間」「再生時間」ラベルの近くから抽出（body全体の「N分」はノイズが多い）
    let duration: number | undefined;
    $('th, dt, td, span, div').each((_, el) => {
      if (duration) return;
      const text = $(el).text();
      if (/(?:収録|再生)時間/.test(text)) {
        const durationMatch = text.match(/(\d{1,3})\s*分/);
        if (durationMatch?.[1]) {
          const mins = parseInt(durationMatch[1]);
          if (mins >= 1 && mins <= 600) duration = mins;
        }
      }
    });

    // リリース日: 「発売日」「配信日」ラベルの近くから抽出
    let releaseDate: string | undefined;
    $('th, dt, td, span, div').each((_, el) => {
      if (releaseDate) return;
      const text = $(el).text();
      if (/(?:発売|配信|リリース)日/.test(text)) {
        const dateMatch = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (dateMatch?.[1] && dateMatch[2] && dateMatch[3]) {
          releaseDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        }
      }
    });
    // フォールバック: ラベルが見つからない場合、隣接セルを探す
    if (!releaseDate) {
      $('th:contains("発売"), th:contains("配信")').each((_, el) => {
        if (releaseDate) return;
        const dateMatch = $(el).next('td').text().match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (dateMatch?.[1] && dateMatch[2] && dateMatch[3]) {
          releaseDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        }
      });
    }

    // 価格: 「価格」「定価」ラベル近くから抽出、body全体はノイズが多い
    let price: number | undefined;
    $('th:contains("価格"), th:contains("定価")').each((_, el) => {
      if (price) return;
      const priceMatch = $(el).next('td').text().match(/(\d{1,3}(?:,\d{3})*)\s*円/);
      if (priceMatch?.[1]) price = parseInt(priceMatch[1].replace(/,/g, ''));
    });
    // フォールバック: class名による検索
    if (!price) {
      const priceMatch = $('.price, .product-price, [class*="price"]').text().match(/(\d{1,3}(?:,\d{3})*)\s*円/);
      if (priceMatch?.[1]) price = parseInt(priceMatch[1].replace(/,/g, ''));
    }

    let sampleVideoUrl: string | undefined;
    const videoMatch = html.match(/https?:\/\/[^"'\s]+\.mp4/i);
    if (videoMatch) sampleVideoUrl = videoMatch[0];

    const result: SokmilProduct & { rawHtml: string } = {
      itemId,
      title,
      performers,
      affiliateUrl: `https://www.sokmil.com/av/_item/item${itemId}.html?aff_id=${AFFILIATE_ID}`,
      rawHtml: html,
    };
    if (description !== undefined) result.description = description;
    if (thumbnailUrl !== undefined) result.thumbnailUrl = thumbnailUrl;
    if (sampleVideoUrl !== undefined) result.sampleVideoUrl = sampleVideoUrl;
    if (duration !== undefined) result.duration = duration;
    if (releaseDate !== undefined) result.releaseDate = releaseDate;
    if (price !== undefined) result.price = price;

    return result;
  } catch {
    return null;
  }
}

interface CrawlSokmilScrapeHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createCrawlSokmilScrapeHandler(deps: CrawlSokmilScrapeHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();
    const TIME_LIMIT = 150_000; // 150秒（Cloud Scheduler 180秒タイムアウトの83%）
    const stats: CrawlStats = { totalFetched: 0, newProducts: 0, updatedProducts: 0, errors: 0, rawDataSaved: 0, videosAdded: 0 };

    try {
      const url = new URL(request['url']);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const productIds = await getProductIdsFromListPage(page);
      if (productIds.length === 0) {
        return NextResponse.json({ success: true, message: 'No products found', stats, duration: '0s' });
      }

      // バッチ用: 演者データ収集
      const allPerformerNames = new Set<string>();
      const pendingPerformerLinks: { productId: number; performerNames: string[] }[] = [];

      for (const itemId of productIds.slice(0, limit)) {
        if (Date.now() - startTime > TIME_LIMIT) {
          console.log(`[crawl-sokmil-scrape] Time limit reached, processed ${stats.totalFetched}/${limit}`);
          break;
        }
        const product = await parseDetailPage(itemId);
        if (!product) { stats.errors++; continue; }

        stats.totalFetched++;

        try {
          const normalizedProductId = `sokmil-${product.itemId}`;
          const detailUrl = `https://www.sokmil.com/av/_item/item${product.itemId}.html`;
          // HTMLはparseDetailPageで既に取得済み
          const hash = createHash('sha256').update(product.rawHtml).digest('hex');

          await db.execute(sql`
            INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
            VALUES ('Sokmil', ${product.itemId}, ${detailUrl}, ${product.rawHtml}, ${hash})
            ON CONFLICT (source, product_id) DO UPDATE SET html_content = EXCLUDED.html_content, hash = EXCLUDED.hash, fetched_at = NOW()
          `);
          stats.rawDataSaved++;

          const productResult = await db.execute(sql`
            INSERT INTO products (normalized_product_id, title, description, release_date, duration, default_thumbnail_url, updated_at)
            VALUES (${normalizedProductId}, ${product['title']}, ${product['description'] || null}, ${product['releaseDate'] ? new Date(product['releaseDate']) : null}, ${product['duration'] || null}, ${product['thumbnailUrl'] || null}, NOW())
            ON CONFLICT (normalized_product_id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, release_date = EXCLUDED.release_date, duration = EXCLUDED.duration, default_thumbnail_url = EXCLUDED.default_thumbnail_url, updated_at = NOW()
            RETURNING id, (xmax = 0) AS is_new
          `);

          const row = productResult.rows[0] as { id: number; is_new: boolean };
          const productId = row.id;
          if (row.is_new) stats.newProducts++; else stats.updatedProducts++;

          await db.execute(sql`
            INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url, price, product_type, data_source, last_updated)
            VALUES (${productId}, 'Sokmil', ${product.itemId}, ${product['affiliateUrl']}, ${product['price'] || null}, 'haishin', 'CRAWL', NOW())
            ON CONFLICT (product_id, asp_name) DO UPDATE SET affiliate_url = EXCLUDED.affiliate_url, price = EXCLUDED.price, product_type = EXCLUDED.product_type, last_updated = NOW()
          `);

          // 出演者をバッチ用に収集
          if (product.performers.length > 0) {
            for (const name of product.performers) {
              allPerformerNames.add(name);
            }
            pendingPerformerLinks.push({ productId, performerNames: product.performers });
          }

          if (product['sampleVideoUrl']) {
            const videoResult = await db.execute(sql`INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order) VALUES (${productId}, 'Sokmil', ${product['sampleVideoUrl']}, 'sample', 0) ON CONFLICT DO NOTHING RETURNING id`);
            if (videoResult.rowCount && videoResult.rowCount > 0) stats.videosAdded++;
          }

          await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
          stats.errors++;
          console.error(`Error processing Sokmil ${product.itemId}:`, error);
        }
      }

      // バッチ: 演者UPSERT + 紐付けINSERT
      if (allPerformerNames.size > 0) {
        const performerData = [...allPerformerNames].map(name => ({ name }));
        const upsertedPerformers = await batchUpsertPerformers(db, performerData);
        const nameToId = new Map(upsertedPerformers.map(p => [p.name, p.id]));

        const links: { productId: number; performerId: number }[] = [];
        for (const { productId, performerNames } of pendingPerformerLinks) {
          for (const name of performerNames) {
            const performerId = nameToId.get(name);
            if (performerId) {
              links.push({ productId, performerId });
            }
          }
        }

        await batchInsertProductPerformers(db, links);
      }

      return NextResponse.json({ success: true, message: 'Sokmil scrape completed', params: { page, limit }, stats, duration: `${Math.round((Date.now() - startTime) / 1000)}s` });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error', stats }, { status: 500 });
    }
  };
}
