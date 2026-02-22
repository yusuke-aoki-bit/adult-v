/**
 * HEYDOUGA クローラー ハンドラー
 *
 * Hey動画から新着作品を取得（複合ID: providerId-movieId）
 * 2つのモード: homepage（トップページ新着） + scan（provider別連番スキャン）
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
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

interface HeydougaProduct {
  productId: string; // "providerId-movieId"
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  releaseDate?: string;
  duration?: number;
}

const AFFILIATE_ID = '39614';

// 主要プロバイダーとmovieID範囲（大きい方から優先）
const PROVIDER_CONFIGS = [
  { providerId: '4030', maxMovieId: 2500, label: 'PPV' },
  { providerId: '4170', maxMovieId: 500, label: '素人' },
  { providerId: '4037', maxMovieId: 500, label: 'レズ' },
  { providerId: '4004', maxMovieId: 300, label: '熟女' },
  { providerId: '4080', maxMovieId: 200, label: 'フェチ' },
];

function generateAffiliateUrl(providerId: string, movieId: string): string {
  const originalUrl = `https://www.heydouga.com/moviepages/${providerId}/${movieId}/index.html`;
  return `https://click.dtiserv2.com/Direct/${AFFILIATE_ID}/${encodeURIComponent(originalUrl)}`;
}

/** トップページから商品IDリストを抽出 */
async function fetchProductIds(): Promise<string[]> {
  try {
    const response = await fetch('https://www.heydouga.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });
    if (!response.ok) return [];

    const html = await response.text();
    const ids: string[] = [];
    const matches = html.matchAll(/\/moviepages\/(\d+)\/(\d+)\/?/g);
    for (const match of matches) {
      const id = `${match[1]}-${match[2]}`;
      if (!ids.includes(id)) {
        ids.push(id);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

/** 詳細ページをパース */
async function parseDetailPage(providerId: string, movieId: string): Promise<HeydougaProduct | null> {
  const url = `https://www.heydouga.com/moviepages/${providerId}/${movieId}/index.html`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });
    if (!response.ok) return null;

    const html = await response.text();

    // タイトル
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    let title = titleMatch?.[1]?.trim();
    if (title) {
      title = title.replace(/\s*-\s*Hey動画.*$/, '').trim();
    }
    if (!title || title.length < 3) return null;

    // 説明
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    const description = descMatch?.[1]?.trim();

    // 出演者: img.nomovie の alt → actressリンクのフォールバック
    const performers: string[] = [];
    const imgAltMatches = html.matchAll(/<img[^>]*class="[^"]*nomovie[^"]*"[^>]*alt="([^"]+)"/gi);
    for (const m of imgAltMatches) {
      const name = m[1]?.trim();
      if (name && !performers.includes(name) && name.length > 1 && name.length < 30) {
        performers.push(name);
      }
    }
    if (performers.length === 0) {
      const actressMatches = html.matchAll(/<a[^>]*href="[^"]*\/actress\/[^"]*"[^>]*>([^<]+)<\/a>/gi);
      for (const m of actressMatches) {
        const name = m[1]?.trim();
        if (name && !performers.includes(name) && name.length > 1 && name.length < 30) {
          performers.push(name);
        }
      }
    }

    // リリース日
    const dateMatch = html.match(/配信日[:：]?\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
    const releaseDate = dateMatch?.[1] && dateMatch[2] && dateMatch[3]
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
      : undefined;

    // 再生時間
    const durationMatch = html.match(/(?:再生時間|収録時間)[:：]?\s*(\d+)\s*(?:分|min)/);
    const duration = durationMatch?.[1] ? parseInt(durationMatch[1]) : undefined;

    // サムネイル（固定パターン）
    const thumbnailUrl = `https://www.heydouga.com/contents/${providerId}/${movieId}/player_thumb.webp`;

    const result: HeydougaProduct = {
      productId: `${providerId}-${movieId}`,
      title,
      performers,
    };
    if (description) result.description = description;
    if (thumbnailUrl) result.thumbnailUrl = thumbnailUrl;
    if (releaseDate) result.releaseDate = releaseDate;
    if (duration) result.duration = duration;

    return result;
  } catch {
    return null;
  }
}

/** 商品をDBに保存する共通関数 */
async function saveProduct(
  db: DbExecutor,
  product: HeydougaProduct,
  stats: CrawlStats,
  allPerformerNames: Set<string>,
  pendingPerformerLinks: { productId: number; performerNames: string[] }[],
): Promise<void> {
  const [providerId, movieId] = product.productId.split('-');
  const compositeId = product.productId;
  const normalizedProductId = `HEYDOUGA-${compositeId}`;
  const detailUrl = `https://www.heydouga.com/moviepages/${providerId}/${movieId}/index.html`;

  // Raw HTML保存
  const htmlResponse = await fetch(detailUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await htmlResponse.text();
  const hash = createHash('sha256').update(html).digest('hex');

  await db.execute(sql`
    INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
    VALUES ('HEYDOUGA', ${compositeId}, ${detailUrl}, ${html}, ${hash})
    ON CONFLICT (source, product_id) DO UPDATE SET
      html_content = EXCLUDED.html_content, hash = EXCLUDED.hash, crawled_at = NOW()
  `);
  stats.rawDataSaved++;

  // 商品保存
  const affiliateUrl = generateAffiliateUrl(providerId!, movieId!);
  const productResult = await db.execute(sql`
    INSERT INTO products (normalized_product_id, title, description, release_date, default_thumbnail_url, updated_at)
    VALUES (${normalizedProductId}, ${product.title}, ${product.description || null},
      ${product.releaseDate ? new Date(product.releaseDate) : null}, ${product.thumbnailUrl || null}, NOW())
    ON CONFLICT (normalized_product_id) DO UPDATE SET
      title = EXCLUDED.title, description = EXCLUDED.description,
      release_date = EXCLUDED.release_date, default_thumbnail_url = EXCLUDED.default_thumbnail_url, updated_at = NOW()
    RETURNING id, (xmax = 0) AS is_new
  `);

  const row = productResult.rows[0] as { id: number; is_new: boolean };
  const dbProductId = row.id;
  if (row.is_new) stats.newProducts++; else stats.updatedProducts++;

  await db.execute(sql`
    INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url, product_type, data_source, last_updated)
    VALUES (${dbProductId}, 'HEYDOUGA', ${compositeId}, ${affiliateUrl}, 'haishin', 'CRAWL', NOW())
    ON CONFLICT (product_id, asp_name) DO UPDATE SET
      affiliate_url = EXCLUDED.affiliate_url, product_type = EXCLUDED.product_type, last_updated = NOW()
  `);

  // 出演者をバッチ用に収集
  if (product.performers.length > 0) {
    for (const name of product.performers) {
      allPerformerNames.add(name);
    }
    pendingPerformerLinks.push({ productId: dbProductId, performerNames: product.performers });
  }
}

interface CrawlHeydougaHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createCrawlHeydougaHandler(deps: CrawlHeydougaHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();
    const TIME_LIMIT = 150_000; // 150秒（Cloud Scheduler 180秒タイムアウトの83%）

    const stats: CrawlStats = {
      totalFetched: 0,
      newProducts: 0,
      updatedProducts: 0,
      errors: 0,
      rawDataSaved: 0,
      videosAdded: 0,
    };

    try {
      const url = new URL(request['url']);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const mode = url.searchParams.get('mode') || 'scan'; // 'homepage' or 'scan'

      // バッチ用: 演者データ収集
      const allPerformerNames = new Set<string>();
      const pendingPerformerLinks: { productId: number; performerNames: string[] }[] = [];

      if (mode === 'homepage') {
        // --- ホームページモード: トップページの新着を取得 ---
        const productIds = await fetchProductIds();
        if (productIds.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No product IDs found on HEYDOUGA homepage',
            stats,
          }, { status: 502 });
        }

        console.log(`[crawl-heydouga] Homepage: Found ${productIds.length} products`);

        for (const compositeId of productIds.slice(0, limit)) {
          if (Date.now() - startTime > TIME_LIMIT) break;

          const [providerId, movieId] = compositeId.split('-');
          if (!providerId || !movieId) continue;

          const product = await parseDetailPage(providerId, movieId);
          if (!product) {
            stats.errors++;
            await new Promise(r => setTimeout(r, 500));
            continue;
          }

          stats.totalFetched++;

          try {
            await saveProduct(db, product, stats, allPerformerNames, pendingPerformerLinks);
          } catch (error) {
            stats.errors++;
            console.error(`[crawl-heydouga] Error processing ${compositeId}:`, error);
          }

          await new Promise(r => setTimeout(r, 1500));
        }
      } else {
        // --- スキャンモード: provider別に連番スキャン (auto-resume) ---
        const providerParam = url.searchParams.get('provider');

        // 対象providerを決定
        const providers = providerParam
          ? PROVIDER_CONFIGS.filter(p => p.providerId === providerParam)
          : PROVIDER_CONFIGS;

        if (providers.length === 0) {
          return NextResponse.json({
            success: false,
            error: `Unknown provider: ${providerParam}`,
            availableProviders: PROVIDER_CONFIGS.map(p => `${p.providerId} (${p.label})`),
          }, { status: 400 });
        }

        const MAX_CONSECUTIVE_NOT_FOUND = 15;

        for (const providerConfig of providers) {
          if (Date.now() - startTime > TIME_LIMIT) break;
          if (stats.totalFetched >= limit) break;

          const { providerId, maxMovieId } = providerConfig;

          // auto-resume: このproviderの最後のmovieIdを取得
          const lastResult = await db.execute(sql`
            SELECT original_product_id FROM product_sources
            WHERE asp_name = 'HEYDOUGA'
              AND original_product_id LIKE ${providerId + '-%'}
            ORDER BY original_product_id DESC LIMIT 1
          `);
          const lastId = lastResult.rows[0]
            ? parseInt((lastResult.rows[0] as { original_product_id: string }).original_product_id.split('-')[1] || '0')
            : 0;
          let currentMovieId = lastId + 1;

          console.log(`[crawl-heydouga] Scan provider=${providerId} (${providerConfig.label}): start=${currentMovieId}`);

          let consecutiveNotFound = 0;

          while (
            currentMovieId <= maxMovieId &&
            stats.totalFetched < limit &&
            Date.now() - startTime < TIME_LIMIT
          ) {
            if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
              console.log(`[crawl-heydouga] Provider ${providerId}: ${MAX_CONSECUTIVE_NOT_FOUND} consecutive not found, moving on`);
              break;
            }

            const movieIdStr = String(currentMovieId).padStart(3, '0');
            const product = await parseDetailPage(providerId, movieIdStr);

            if (!product) {
              consecutiveNotFound++;
              currentMovieId++;
              await new Promise(r => setTimeout(r, 500));
              continue;
            }

            consecutiveNotFound = 0;
            stats.totalFetched++;

            try {
              await saveProduct(db, product, stats, allPerformerNames, pendingPerformerLinks);
            } catch (error) {
              stats.errors++;
              console.error(`[crawl-heydouga] Error processing ${providerId}-${movieIdStr}:`, error);
            }

            currentMovieId++;
            await new Promise(r => setTimeout(r, 1500));
          }
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

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: `HEYDOUGA crawl completed (mode=${mode})`,
        stats,
        duration: `${duration}s`,
      });

    } catch (error) {
      console.error('[crawl-heydouga] Error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error', stats },
        { status: 500 }
      );
    }
  };
}
