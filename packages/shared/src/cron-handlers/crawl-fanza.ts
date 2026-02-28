/**
 * FANZA クローラー ハンドラー (fetch版)
 *
 * HTTPフェッチでFANZA商品ページからJSON-LDデータを抽出
 * Puppeteer不要の軽量版 - Cloud Schedulerから定期実行
 *
 * リストページからCIDを取得→詳細ページをフェッチ→JSON-LD抽出
 * auto-resume: DB件数からページ番号を自動計算
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { DbExecutor } from '../db-queries/types';
import { batchUpsertPerformers, batchInsertProductPerformers } from '../utils/batch-db';
import { crawlerFetch } from '../lib/crawler-fetch';
import { createSaleHelperQueries, type SaleInfo } from '../db-queries/sale-helper';

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
  videosAdded: number;
  salesDetected: number;
  skipped: number;
  listPagesScanned: number;
  cidsFound: number;
}

interface FanzaProduct {
  cid: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  releaseDate?: string;
  duration?: number;
  price?: number;
  genres?: string[];
  maker?: string;
  label?: string;
  series?: string;
  sampleVideos?: string[];
  saleInfo?: SaleInfo;
}

const AFFILIATE_ID = 'minpri-001';

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  Cookie: 'age_check_done=1; cklg=ja; ckcy=1',
  Referer: 'https://www.dmm.co.jp/',
};

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return crawlerFetch(url, { ...init, timeout: 15_000 });
}

function generateAffiliateUrl(cid: string): string {
  return `https://al.dmm.co.jp/?lurl=https%3A%2F%2Fvideo.dmm.co.jp%2Fav%2Fcontent%2F%3Fid%3D${cid}&af_id=${AFFILIATE_ID}`;
}

/** リストページからCIDリストを取得（旧URL: SSR対応） */
async function fetchCidsFromListPage(page: number): Promise<string[]> {
  const url = `https://www.dmm.co.jp/digital/videoa/-/list/=/sort=date/page=${page}/`;

  try {
    const response = await fetchWithTimeout(url, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
    });
    if (!response.ok) return [];

    const html = await response.text();
    if (html.length < 500) return [];

    const cidSet = new Set<string>();

    // パターン1: /cid=xxx/ (リンク内)
    for (const match of html.matchAll(/cid=([a-z][a-z0-9]{4,})/gi)) {
      const cid = match[1];
      if (cid) {
        cidSet.add(cid);
      }
    }

    // パターン2: /video/xxx/ (画像URL)
    if (cidSet.size === 0) {
      for (const match of html.matchAll(/\/video\/([a-z][a-z0-9]{4,})\//gi)) {
        const cid = match[1];
        if (cid) {
          cidSet.add(cid);
        }
      }
    }

    // パターン3: /av/detail/ or /av/content/ リンク
    if (cidSet.size === 0) {
      for (const match of html.matchAll(/\/av\/(?:detail|content)\/[^"]*?(?:cid=|id=)([a-z][a-z0-9]{4,})/gi)) {
        const cid = match[1];
        if (cid) {
          cidSet.add(cid);
        }
      }
    }

    return Array.from(cidSet);
  } catch {
    return [];
  }
}

/** 詳細ページHTMLを取得 */
async function fetchDetailHtml(cid: string): Promise<string | null> {
  // 旧URL形式（SSR）を優先、フォールバックに新URL
  const urls = [
    `https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=${cid}/`,
    `https://video.dmm.co.jp/av/content/?id=${cid}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: FETCH_HEADERS,
        redirect: 'follow',
      });
      if (!response.ok) continue;

      const html = await response.text();
      if (html.length < 1000) continue;

      // 最低限のコンテンツ検出
      if (html.includes('<title') || html.includes('ld+json')) {
        return html;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/** HTMLからプロダクトデータを抽出 */
function parseProductHtml(html: string, cid: string): FanzaProduct | null {
  // JSON-LD構造化データから抽出（最も信頼性が高い）
  let jsonLdData: Record<string, unknown> | null = null;
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      jsonLdData = JSON.parse(jsonLdMatch[1]!);
    } catch {
      /* fallback to HTML parsing */
    }
  }

  // タイトル
  let title = '';
  if (jsonLdData && typeof jsonLdData['name'] === 'string') {
    title = jsonLdData['name'];
  } else {
    const titleMatch =
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<]+?)(?:\s*[｜|]\s*[^<]*)?<\/title>/i);
    title = titleMatch?.[1]?.trim() ?? '';
  }
  if (!title || title.length < 3) return null;
  title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  title = title.replace(/【[^】]*(?:OFF|セール|キャンペーン|新作|独占|最新)[^】]*】/g, '').trim();

  // 出演者（JSON-LD actor配列）
  const performers: string[] = [];
  const actorData = jsonLdData?.['actor'];
  if (Array.isArray(actorData)) {
    for (const actor of actorData) {
      const name = (actor as Record<string, unknown>)?.['name'];
      if (typeof name === 'string' && !performers.includes(name)) {
        performers.push(name);
      }
    }
  }
  if (performers.length === 0) {
    for (const match of html.matchAll(/href="[^"]*\/av\/list\/\?actress=\d+"[^>]*>([^<]+)</gi)) {
      const name = match[1]?.trim();
      if (name && name.length < 30 && !name.includes('一覧') && !performers.includes(name)) {
        performers.push(name);
      }
    }
  }

  // ジャンル
  const genres: string[] = [];
  const genreData = jsonLdData?.['genre'];
  if (Array.isArray(genreData)) {
    for (const g of genreData) {
      if (typeof g === 'string' && !genres.includes(g)) genres.push(g);
    }
  }

  // サムネイル
  let thumbnailUrl: string | undefined;
  const imageData = jsonLdData?.['image'];
  if (typeof imageData === 'string') {
    thumbnailUrl = imageData;
  } else if (Array.isArray(imageData) && typeof imageData[0] === 'string') {
    thumbnailUrl = imageData[0];
  }
  if (!thumbnailUrl) {
    const thumbMatch = html.match(/src="(https:\/\/awsimgsrc\.dmm\.co\.jp\/[^"]*pl\.jpg[^"]*)"/i);
    thumbnailUrl = thumbMatch?.[1];
  }

  // リリース日
  let releaseDate: string | undefined;
  const datePublished = jsonLdData?.['datePublished'];
  if (typeof datePublished === 'string') {
    releaseDate = datePublished;
  } else {
    const dateMatch = html.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (dateMatch) {
      releaseDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }
  }

  // 収録時間
  let duration: number | undefined;
  const durationData = jsonLdData?.['duration'];
  if (typeof durationData === 'string') {
    let mins = 0;
    const hoursMatch = durationData.match(/PT(\d+)H/i);
    if (hoursMatch) mins += parseInt(hoursMatch[1]!, 10) * 60;
    const minsMatch = durationData.match(/(\d+)M/i);
    if (minsMatch) mins += parseInt(minsMatch[1]!, 10);
    const secsMatch = durationData.match(/(\d+)S/i);
    if (secsMatch && mins === 0) mins = Math.round(parseInt(secsMatch[1]!, 10) / 60);
    if (mins >= 1 && mins <= 600) duration = mins;
  }
  if (!duration) {
    const durationMatch = html.match(/収録時間[\s\S]{0,100}?(\d{1,3})分/i);
    if (durationMatch) {
      const mins = parseInt(durationMatch[1]!, 10);
      if (mins >= 1 && mins <= 600) duration = mins;
    }
  }

  // 価格（HTML汎用抽出 - JSON-LDのoffers.priceは月額見放題の最安値のため不使用）
  let price: number | undefined;
  const priceMatches = [...html.matchAll(/(\d{1,3}(?:,\d{3})*)円/g)];
  const validPrices = priceMatches
    .map((m) => parseInt(m[1]?.replace(/,/g, '') ?? '0', 10))
    .filter((p) => p >= 500 && p <= 10000);
  if (validPrices.length > 0) {
    const typicalPrices = validPrices.filter((p) => p >= 800 && p <= 3500);
    price = typicalPrices.length > 0 ? Math.max(...typicalPrices) : Math.max(...validPrices);
  }

  // セール検出
  let saleInfo: SaleInfo | undefined;
  if (price) {
    // パターン1: 取り消し線価格 (<del>, <s>, <strike>)
    const strikeMatch = html.match(
      /<(?:del|s|strike)[^>]*>\s*[¥￥]?\s*(\d{1,3}(?:,\d{3})*)\s*(?:円|pt)\s*<\/(?:del|s|strike)>/i,
    );
    if (strikeMatch?.[1]) {
      const regularPrice = parseInt(strikeMatch[1].replace(/,/g, ''), 10);
      if (regularPrice > price && regularPrice >= 500 && regularPrice <= 15000) {
        const discountPercent = Math.round((1 - price / regularPrice) * 100);
        if (discountPercent >= 5) {
          saleInfo = { regularPrice, salePrice: price, discountPercent, saleType: 'timesale' };
        }
      }
    }
    // パターン2: %OFF表記から元値を逆算
    if (!saleInfo) {
      const offMatch = html.match(/(\d+)\s*%\s*(?:OFF|オフ|off)/i);
      if (offMatch?.[1]) {
        const discountPercent = parseInt(offMatch[1], 10);
        if (discountPercent >= 10 && discountPercent <= 80) {
          const regularPrice = Math.round(price / (1 - discountPercent / 100));
          if (regularPrice >= 500 && regularPrice <= 15000) {
            saleInfo = { regularPrice, salePrice: price, discountPercent, saleType: 'timesale' };
          }
        }
      }
    }
    // パターン3: 定価/通常価格ラベル
    if (!saleInfo) {
      const regularPriceMatch = html.match(/(?:定価|通常価格|希望小売価格)[：:\s]*[¥￥]?\s*(\d{1,3}(?:,\d{3})*)\s*円/i);
      if (regularPriceMatch?.[1]) {
        const regularPrice = parseInt(regularPriceMatch[1].replace(/,/g, ''), 10);
        if (regularPrice > price && regularPrice >= 500 && regularPrice <= 15000) {
          const discountPercent = Math.round((1 - price / regularPrice) * 100);
          if (discountPercent >= 5) {
            saleInfo = { regularPrice, salePrice: price, discountPercent, saleType: 'sale' };
          }
        }
      }
    }
  }

  // メーカー・レーベル・シリーズ
  const makerMatch = html.match(/href="[^"]*(?:\/av\/list\/\?maker=|maker\/)\d+"?[^>]*>([^<]+)</i);
  const maker = makerMatch?.[1]?.trim();
  const labelMatch = html.match(/href="[^"]*(?:\/av\/list\/\?label=|label\/)\d+"?[^>]*>([^<]+)</i);
  const label = labelMatch?.[1]?.trim();
  const seriesMatch = html.match(/href="[^"]*(?:\/av\/list\/\?series=|series\/)\d+"?[^>]*>([^<]+)</i);
  const series = seriesMatch?.[1]?.trim();

  // サンプル動画
  const sampleVideos: string[] = [];
  const videoUrlSet = new Set<string>();
  const videoPatterns = [
    /src="(https:\/\/[^"]*litevideo[^"]*\.mp4[^"]*)"/gi,
    /data-src="(https:\/\/[^"]*(?:sample|preview)[^"]*\.mp4[^"]*)"/gi,
    /["'](https:\/\/cc3001\.dmm\.co\.jp\/[^"']*\.mp4[^"']*)["']/gi,
  ];
  for (const pattern of videoPatterns) {
    for (const match of html.matchAll(pattern)) {
      const videoUrl = match[1]?.split('?')[0];
      if (videoUrl && !videoUrlSet.has(videoUrl)) {
        videoUrlSet.add(videoUrl);
        sampleVideos.push(videoUrl);
      }
    }
  }

  const result: FanzaProduct = { cid, title, performers };
  if (thumbnailUrl) result.thumbnailUrl = thumbnailUrl;
  if (releaseDate) result.releaseDate = releaseDate;
  if (duration) result.duration = duration;
  if (price) result.price = price;
  if (genres.length > 0) result.genres = genres;
  if (maker) result.maker = maker;
  if (label) result.label = label;
  if (series) result.series = series;
  if (sampleVideos.length > 0) result.sampleVideos = sampleVideos;
  if (saleInfo) result.saleInfo = saleInfo;

  return result;
}

interface CrawlFanzaHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createCrawlFanzaHandler(deps: CrawlFanzaHandlerDeps) {
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
      salesDetected: 0,
      skipped: 0,
      listPagesScanned: 0,
      cidsFound: 0,
    };

    const saleHelper = createSaleHelperQueries({ getDb: deps.getDb });

    try {
      const url = new URL(request['url']);
      const limit = parseInt(url.searchParams.get('limit') || '30');

      // auto-resume: DBからリストページのオフセットを取得
      let currentPage: number;
      if (url.searchParams.has('page')) {
        currentPage = parseInt(url.searchParams.get('page')!);
      } else {
        // product_sourcesのFANZA件数からページ番号を推定（1ページ≈50件）
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as cnt FROM product_sources WHERE asp_name = 'FANZA'
        `);
        const totalProducts = parseInt(String((countResult.rows[0] as { cnt: string }).cnt)) || 0;
        currentPage = Math.max(1, Math.floor(totalProducts / 50) + 1);
        console.log(`[crawl-fanza] Auto-resume from page=${currentPage} (${totalProducts} products in DB)`);
      }

      const initialPage = currentPage;
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

      // リストページからCIDを取得して詳細ページを処理
      while (Date.now() - startTime < TIME_LIMIT && stats.totalFetched < limit) {
        console.log(`[crawl-fanza] Fetching list page ${currentPage}...`);

        const cids = await fetchCidsFromListPage(currentPage);
        stats.listPagesScanned++;

        if (cids.length === 0) {
          console.log(`[crawl-fanza] No CIDs found on page ${currentPage}, stopping`);
          break;
        }

        stats.cidsFound += cids.length;
        console.log(`[crawl-fanza] Found ${cids.length} CIDs on page ${currentPage}`);

        // バッチ既存チェック: 全CIDを一括クエリ
        const cidValues = sql.join(
          cids.map((c) => sql`${c}`),
          sql`, `,
        );
        const existingResult = await db.execute(sql`
          SELECT original_product_id FROM product_sources
          WHERE asp_name = 'FANZA' AND original_product_id IN (${cidValues})
        `);
        const existingCids = new Set(
          (existingResult.rows as { original_product_id: string }[]).map((r) => r.original_product_id),
        );

        for (const cid of cids) {
          if (Date.now() - startTime > TIME_LIMIT) break;
          if (stats.totalFetched >= limit) break;

          // 既存チェック（バッチ結果を参照）
          if (existingCids.has(cid)) {
            stats.skipped++;
            continue;
          }

          // レート制限（3秒 + ジッター）
          await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1500));

          const html = await fetchDetailHtml(cid);
          if (!html) {
            stats.errors++;
            continue;
          }

          const product = parseProductHtml(html, cid);
          if (!product) {
            stats.errors++;
            continue;
          }

          stats.totalFetched++;

          try {
            // Raw HTML保存
            const hash = createHash('sha256').update(html).digest('hex');
            await db.execute(sql`
              INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
              VALUES ('FANZA', ${cid}, ${`https://video.dmm.co.jp/av/content/?id=${cid}`}, ${html}, ${hash})
              ON CONFLICT (source, product_id) DO UPDATE SET
                html_content = EXCLUDED.html_content, hash = EXCLUDED.hash, crawled_at = NOW()
            `);
            stats.rawDataSaved++;

            // 商品保存
            const normalizedProductId = `FANZA-${cid}`;
            const productResult = await db.execute(sql`
              INSERT INTO products (
                normalized_product_id, title, release_date,
                duration, default_thumbnail_url, updated_at
              )
              VALUES (
                ${normalizedProductId}, ${product.title},
                ${product.releaseDate ? new Date(product.releaseDate) : null},
                ${product.duration || null}, ${product.thumbnailUrl || null}, NOW()
              )
              ON CONFLICT (normalized_product_id) DO UPDATE SET
                title = EXCLUDED.title, release_date = EXCLUDED.release_date,
                duration = EXCLUDED.duration, default_thumbnail_url = EXCLUDED.default_thumbnail_url,
                updated_at = NOW()
              RETURNING id, (xmax = 0) AS is_new
            `);

            const row = productResult.rows[0] as { id: number; is_new: boolean };
            const productId = row.id;
            if (row.is_new) stats.newProducts++;
            else stats.updatedProducts++;

            // product_sources
            const affiliateUrl = generateAffiliateUrl(cid);
            await db.execute(sql`
              INSERT INTO product_sources (
                product_id, asp_name, original_product_id, affiliate_url,
                price, product_type, data_source, last_updated
              )
              VALUES (
                ${productId}, 'FANZA', ${cid}, ${affiliateUrl},
                ${product.price || null}, 'haishin', 'CRAWL', NOW()
              )
              ON CONFLICT (product_id, asp_name) DO UPDATE SET
                affiliate_url = EXCLUDED.affiliate_url, price = EXCLUDED.price,
                product_type = EXCLUDED.product_type, last_updated = NOW()
            `);

            // セール情報を保存
            if (product.saleInfo) {
              try {
                const saved = await saleHelper.saveSaleInfo('FANZA', cid, product.saleInfo);
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

            // サンプル動画
            if (product.sampleVideos && product.sampleVideos.length > 0) {
              for (let i = 0; i < product.sampleVideos.length; i++) {
                const videoResult = await db.execute(sql`
                  INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
                  VALUES (${productId}, 'FANZA', ${product.sampleVideos[i]}, 'sample', ${i})
                  ON CONFLICT DO NOTHING RETURNING id
                `);
                if (videoResult.rowCount && videoResult.rowCount > 0) stats.videosAdded++;
              }
            }
          } catch (error) {
            stats.errors++;
            console.error(`[crawl-fanza] Error processing ${cid}:`, error);
          }
        }

        // ページ終了時に演者バッチをフラッシュ（タイムアウトによるデータロス防止）
        await flushPerformerBatch();

        currentPage++;

        // ページ間レート制限
        await new Promise((r) => setTimeout(r, 3000));
      }

      // 最終フラッシュ（ループ途中で抜けた場合の残りデータ）
      await flushPerformerBatch();

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'FANZA crawl completed',
        stats,
        resumeInfo: {
          initialPage,
          nextPage: currentPage,
          pagesScanned: stats.listPagesScanned,
        },
        duration: `${duration}s`,
      });
    } catch (error) {
      console.error('[crawl-fanza] Error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error', stats },
        { status: 500 },
      );
    }
  };
}
