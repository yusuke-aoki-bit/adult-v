/**
 * FC2 クローラー ハンドラー
 *
 * FC2コンテンツマーケットから新着作品を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { DbExecutor } from '../db-queries/types';
import { batchUpsertPerformers, batchInsertProductPerformers } from '../utils/batch-db';
import { createSaleHelperQueries } from '../db-queries/sale-helper';
import { proxyFetch } from '../lib/proxy-fetch';

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
  videosAdded: number;
}

interface SaleInfo {
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleType: string;
}

interface FC2Product {
  articleId: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  sampleVideoUrl?: string;
  duration?: number;
  price?: number;
  saleInfo?: SaleInfo;
}

const FC2_AFFUID = process.env['FC2_AFFUID'] || 'TVRFNU5USTJOVEE9';

const FETCH_TIMEOUT = 15_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return proxyFetch(url, { ...init, timeout: FETCH_TIMEOUT });
}

function generateAffiliateUrl(articleId: string): string {
  return `https://adult.contents.fc2.com/aff.php?aid=${articleId}&affuid=${FC2_AFFUID}`;
}

async function fetchArticleIds(page: number = 1): Promise<string[]> {
  const url = `https://adult.contents.fc2.com/newrelease.php?page=${page}`;

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return [];

    const html = await response['text']();
    const articleIds: string[] = [];
    const matches = html.matchAll(/\/article\/(\d+)\//g);
    for (const match of matches) {
      const id = match[1];
      if (id && !articleIds.includes(id)) {
        articleIds.push(id);
      }
    }
    return articleIds;
  } catch {
    return [];
  }
}

async function parseDetailPage(articleId: string): Promise<(FC2Product & { rawHtml: string }) | null> {
  const url = `https://adult.contents.fc2.com/article/${articleId}/`;

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return null;

    const html = await response['text']();

    let title = '';
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch?.[1]) {
      title = ogTitleMatch[1].trim();
    }
    if (!title) {
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match?.[1]) {
        title = h1Match[1].trim();
      }
    }
    if (!title || title.length > 200) {
      title = `FC2-${articleId}`;
    }

    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const description = descMatch?.[1] ? descMatch[1].trim().substring(0, 1000) : undefined;

    const performers: string[] = [];
    const performerMatches = html.matchAll(/<a[^>]*href="[^"]*(?:actress|performer|cast)[^"]*"[^>]*>([^<]+)<\/a>/gi);
    for (const match of performerMatches) {
      const name = match[1]?.trim();
      if (name && !performers.includes(name) && name.length > 1 && name.length < 30) {
        performers.push(name);
      }
    }

    const thumbMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    const thumbnailUrl = thumbMatch?.[1];

    const durationMatch = html.match(/(\d+)\s*分/);
    const duration = durationMatch?.[1] ? parseInt(durationMatch[1]) : undefined;

    const priceMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*(?:円|pt|ポイント)/);
    const price = priceMatch?.[1] ? parseInt(priceMatch[1].replace(/,/g, '')) : undefined;

    // セール検出: 取り消し線価格 or 定価ラベルから元値を抽出
    let saleInfo: SaleInfo | undefined;
    if (price) {
      const delPriceMatch = html.match(/<(?:del|s|strike)[^>]*>\s*(\d{1,3}(?:,\d{3})*)\s*(?:円|pt)/i);
      if (delPriceMatch?.[1]) {
        const regularPrice = parseInt(delPriceMatch[1].replace(/,/g, ''));
        if (regularPrice > price) {
          const discountMatch = html.match(/(\d+)\s*%\s*(?:OFF|オフ|off)/);
          saleInfo = {
            regularPrice,
            salePrice: price,
            discountPercent: discountMatch?.[1]
              ? parseInt(discountMatch[1])
              : Math.round((1 - price / regularPrice) * 100),
            saleType: 'sale',
          };
        }
      }
      if (!saleInfo) {
        const originalMatch = html.match(/(?:定価|通常|元)[価値:]?\s*(\d{1,3}(?:,\d{3})*)\s*(?:円|pt)/i);
        if (originalMatch?.[1]) {
          const regularPrice = parseInt(originalMatch[1].replace(/,/g, ''));
          if (regularPrice > price) {
            saleInfo = {
              regularPrice,
              salePrice: price,
              discountPercent: Math.round((1 - price / regularPrice) * 100),
              saleType: 'sale',
            };
          }
        }
      }
    }

    let sampleVideoUrl: string | undefined;
    const videoSrcMatch = html.match(/<source[^>]*src="([^"]+\.mp4)"/i);
    if (videoSrcMatch?.[1]) {
      sampleVideoUrl = videoSrcMatch[1];
    }

    const result: FC2Product & { rawHtml: string } = {
      articleId,
      title,
      performers,
      rawHtml: html,
    };
    if (description !== undefined) result.description = description;
    if (thumbnailUrl !== undefined) result.thumbnailUrl = thumbnailUrl;
    if (sampleVideoUrl !== undefined) result.sampleVideoUrl = sampleVideoUrl;
    if (duration !== undefined) result.duration = duration;
    if (price !== undefined) result.price = price;
    if (saleInfo !== undefined) result.saleInfo = saleInfo;

    return result;
  } catch {
    return null;
  }
}

interface CrawlFc2HandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createCrawlFc2Handler(deps: CrawlFc2HandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();
    const TIME_LIMIT = 150_000; // 150秒（Cloud Scheduler 180秒タイムアウトの83%）

    const stats: CrawlStats & { salesDetected: number; skipped: number } = {
      totalFetched: 0,
      newProducts: 0,
      updatedProducts: 0,
      errors: 0,
      rawDataSaved: 0,
      videosAdded: 0,
      salesDetected: 0,
      skipped: 0,
    };

    const saleHelper = createSaleHelperQueries({ getDb: deps.getDb });

    try {
      const url = new URL(request['url']);
      const limit = parseInt(url.searchParams.get('limit') || '100');

      // auto-resume: pageパラメータ省略時、DB件数からページ番号を自動計算
      let currentPage: number;
      if (url.searchParams.has('page')) {
        currentPage = parseInt(url.searchParams.get('page')!);
      } else {
        // FC2の1ページ≈30件、DB件数から推定
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as cnt FROM product_sources WHERE asp_name = 'FC2'
        `);
        const totalProducts = parseInt(String((countResult.rows[0] as { cnt: string }).cnt)) || 0;
        currentPage = Math.max(1, Math.floor(totalProducts / 30) + 1);
        console.log(`[crawl-fc2] Auto-resume from page=${currentPage} (${totalProducts} products in DB)`);
      }

      const initialPage = currentPage;
      const MAX_CONSECUTIVE_EMPTY = 3;
      let consecutiveEmpty = 0;

      // バッチ用: 演者データ収集（ページごとにフラッシュ）
      const allPerformerNames = new Set<string>();
      const pendingPerformerLinks: { productId: number; performerNames: string[] }[] = [];

      async function flushPerformerBatch() {
        if (allPerformerNames.size === 0) return;
        const performerData = [...allPerformerNames].map((name) => ({ name }));
        const upsertedPerformers = await batchUpsertPerformers(db, performerData);
        const nameToId = new Map(upsertedPerformers.map((p) => [p.name, p.id]));
        const links: { productId: number; performerId: number }[] = [];
        for (const { productId, performerNames } of pendingPerformerLinks) {
          for (const name of performerNames) {
            const performerId = nameToId.get(name);
            if (performerId) links.push({ productId, performerId });
          }
        }
        await batchInsertProductPerformers(db, links);
        allPerformerNames.clear();
        pendingPerformerLinks.length = 0;
      }

      // ページネーションループ: 時間制限内で複数ページを自動取得
      while (
        Date.now() - startTime < TIME_LIMIT &&
        stats.totalFetched < limit &&
        consecutiveEmpty < MAX_CONSECUTIVE_EMPTY
      ) {
        const articleIds = await fetchArticleIds(currentPage);
        if (articleIds.length === 0) {
          consecutiveEmpty++;
          console.log(
            `[crawl-fc2] No articles on page ${currentPage} (empty: ${consecutiveEmpty}/${MAX_CONSECUTIVE_EMPTY})`,
          );
          currentPage++;
          continue;
        }
        consecutiveEmpty = 0;

        // バッチ既存チェック: 全articleIdを一括クエリ
        const idValues = sql.join(
          articleIds.map((id) => sql`${id}`),
          sql`, `,
        );
        const existingResult = await db.execute(sql`
          SELECT original_product_id FROM product_sources
          WHERE asp_name = 'FC2' AND original_product_id IN (${idValues})
        `);
        const existingArticleIds = new Set(
          (existingResult.rows as { original_product_id: string }[]).map((r) => r.original_product_id),
        );

        let pageHadNewProducts = false;

        for (const articleId of articleIds) {
          if (Date.now() - startTime > TIME_LIMIT) break;
          if (stats.totalFetched >= limit) break;

          // 既存チェック（バッチ結果を参照）
          if (existingArticleIds.has(articleId)) {
            stats.skipped++;
            continue;
          }

          const product = await parseDetailPage(articleId);
          if (!product) {
            stats.errors++;
            continue;
          }

          pageHadNewProducts = true;
          stats.totalFetched++;

          try {
            const normalizedProductId = `FC2-${product.articleId}`;
            const detailUrl = `https://adult.contents.fc2.com/article/${product.articleId}/`;
            // HTMLはparseDetailPageで既に取得済み
            const hash = createHash('sha256').update(product.rawHtml).digest('hex');

            await db.execute(sql`
              INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
              VALUES ('FC2', ${product.articleId}, ${detailUrl}, ${product.rawHtml}, ${hash})
              ON CONFLICT (source, product_id) DO UPDATE SET
                html_content = EXCLUDED.html_content, hash = EXCLUDED.hash, crawled_at = NOW()
            `);
            stats.rawDataSaved++;

            const productResult = await db.execute(sql`
              INSERT INTO products (normalized_product_id, title, description, duration, default_thumbnail_url, updated_at)
              VALUES (${normalizedProductId}, ${product['title']}, ${product['description'] || null}, ${product['duration'] || null}, ${product['thumbnailUrl'] || null}, NOW())
              ON CONFLICT (normalized_product_id) DO UPDATE SET
                title = EXCLUDED.title, description = EXCLUDED.description, duration = EXCLUDED.duration,
                default_thumbnail_url = EXCLUDED.default_thumbnail_url, updated_at = NOW()
              RETURNING id, (xmax = 0) AS is_new
            `);

            const row = productResult.rows[0] as { id: number; is_new: boolean };
            const productId = row.id;
            if (row.is_new) stats.newProducts++;
            else stats.updatedProducts++;

            const affiliateUrl = generateAffiliateUrl(product.articleId);
            await db.execute(sql`
              INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url, price, product_type, data_source, last_updated)
              VALUES (${productId}, 'FC2', ${product.articleId}, ${affiliateUrl}, ${product['price'] || null}, 'haishin', 'CRAWL', NOW())
              ON CONFLICT (product_id, asp_name) DO UPDATE SET
                affiliate_url = EXCLUDED.affiliate_url, price = EXCLUDED.price, product_type = EXCLUDED.product_type, last_updated = NOW()
            `);

            // セール情報を保存
            if (product.saleInfo) {
              try {
                const saved = await saleHelper.saveSaleInfo('FC2', product.articleId, product.saleInfo);
                if (saved) stats.salesDetected++;
              } catch {
                // セール保存失敗は商品保存に影響させない
              }
            }

            // 出演者をバッチ用に収集
            if (product.performers.length > 0) {
              for (const name of product.performers) {
                allPerformerNames.add(name);
              }
              pendingPerformerLinks.push({ productId, performerNames: product.performers });
            }

            if (product['sampleVideoUrl']) {
              const videoResult = await db.execute(sql`
                INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
                VALUES (${productId}, 'FC2', ${product['sampleVideoUrl']}, 'sample', 0)
                ON CONFLICT DO NOTHING RETURNING id
              `);
              if (videoResult.rowCount && videoResult.rowCount > 0) stats.videosAdded++;
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            stats.errors++;
            console.error(`Error processing FC2 product ${product.articleId}:`, error);
          }
        }

        // このページで新商品がなかった場合、consecutiveEmptyをカウント
        if (!pageHadNewProducts) {
          consecutiveEmpty++;
        }

        // ページ終了時に演者バッチをフラッシュ（タイムアウトによるデータロス防止）
        await flushPerformerBatch();

        currentPage++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // 最終フラッシュ（ループ途中で抜けた場合の残りデータ）
      await flushPerformerBatch();

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'FC2 crawl completed',
        stats,
        resumeInfo: {
          initialPage,
          nextPage: currentPage,
          pagesScanned: currentPage - initialPage,
        },
        duration: `${duration}s`,
      });
    } catch (error) {
      console.error('FC2 crawl error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error', stats },
        { status: 500 },
      );
    }
  };
}
