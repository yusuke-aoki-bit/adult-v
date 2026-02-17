/**
 * DTI クローラー ハンドラー
 *
 * DTI系サイト（カリビアンコム、一本道、HEYZO等）をクロール
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

interface SiteConfig {
  siteName: string;
  aspName: string; // DB上のASP名 (product_sources.asp_name)
  siteId: string;
  baseUrl: string;
  urlPattern: string;
  idFormat: 'MMDDYY_NNN' | 'NNNN';
  defaultStart: string;
  reverseMode: boolean;
  jsonApiUrl?: string;
}

const SITE_CONFIGS: Record<string, SiteConfig> = {
  'caribbeancom': {
    siteName: 'カリビアンコム',
    aspName: 'CARIBBEANCOM',
    siteId: '2478',
    baseUrl: 'https://www.caribbeancom.com',
    urlPattern: 'https://www.caribbeancom.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    defaultStart: '112924_001',
    reverseMode: true,
  },
  'caribbeancompr': {
    siteName: 'カリビアンコムプレミアム',
    aspName: 'CARIBBEANCOMPR',
    siteId: '2477',
    baseUrl: 'https://www.caribbeancompr.com',
    urlPattern: 'https://www.caribbeancompr.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    defaultStart: '112924_001',
    reverseMode: true,
  },
  '1pondo': {
    siteName: '一本道',
    aspName: '1PONDO',
    siteId: '2470',
    baseUrl: 'https://www.1pondo.tv',
    urlPattern: 'https://www.1pondo.tv/movies/{id}/',
    idFormat: 'MMDDYY_NNN',
    defaultStart: '112924_001',
    reverseMode: true,
    jsonApiUrl: 'https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/{id}.json',
  },
  'heyzo': {
    siteName: 'HEYZO',
    aspName: 'HEYZO',
    siteId: '2665',
    baseUrl: 'https://www.heyzo.com',
    urlPattern: 'https://www.heyzo.com/moviepages/{id}/index.html',
    idFormat: 'NNNN',
    defaultStart: '3500',
    reverseMode: false,
  },
  '10musume': {
    siteName: '天然むすめ',
    aspName: '10MUSUME',
    siteId: '2471',
    baseUrl: 'https://www.10musume.com',
    urlPattern: 'https://www.10musume.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    defaultStart: '112924_001',
    reverseMode: true,
  },
  'pacopacomama': {
    siteName: 'パコパコママ',
    aspName: 'PACOPACOMAMA',
    siteId: '2472',
    baseUrl: 'https://www.pacopacomama.com',
    urlPattern: 'https://www.pacopacomama.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    defaultStart: '112924_001',
    reverseMode: true,
  },
};

const AFFILIATE_ID = '39614';

function generateAffiliateUrl(originalUrl: string): string {
  const encodedUrl = encodeURIComponent(originalUrl);
  return `https://click.dtiserv2.com/Direct/${AFFILIATE_ID}/${encodedUrl}`;
}

function generateNextId(currentId: string, format: 'MMDDYY_NNN' | 'NNNN', reverseMode: boolean): string | null {
  if (format === 'NNNN') {
    const num = parseInt(currentId);
    return reverseMode ? String(num - 1).padStart(4, '0') : String(num + 1).padStart(4, '0');
  }

  const [datePart, numPart] = currentId.split('_');
  if (!datePart || !numPart) return null;

  let num = parseInt(numPart);
  const month = parseInt(datePart.substring(0, 2));
  const day = parseInt(datePart.substring(2, 4));
  const year = parseInt(datePart.substring(4, 6));

  if (reverseMode) {
    num--;
    if (num < 1) {
      num = 999;
      const date = new Date(2000 + year, month - 1, day - 1);
      const newMonth = String(date.getMonth() + 1).padStart(2, '0');
      const newDay = String(date.getDate()).padStart(2, '0');
      const newYear = String(date.getFullYear() - 2000).padStart(2, '0');
      return `${newMonth}${newDay}${newYear}_${String(num).padStart(3, '0')}`;
    }
    return `${datePart}_${String(num).padStart(3, '0')}`;
  } else {
    num++;
    if (num > 999) {
      num = 1;
      const date = new Date(2000 + year, month - 1, day + 1);
      const newMonth = String(date.getMonth() + 1).padStart(2, '0');
      const newDay = String(date.getDate()).padStart(2, '0');
      const newYear = String(date.getFullYear() - 2000).padStart(2, '0');
      return `${newMonth}${newDay}${newYear}_${String(num).padStart(3, '0')}`;
    }
    return `${datePart}_${String(num).padStart(3, '0')}`;
  }
}

function decodeHtml(buffer: Buffer, contentType?: string, _url?: string): string {
  let encoding = 'utf-8';
  if (contentType) {
    const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
    if (charsetMatch?.[1]) {
      encoding = charsetMatch[1].toLowerCase();
    }
  }

  if (encoding === 'euc-jp' || encoding === 'eucjp') {
    try {
      const decoder = new TextDecoder('euc-jp');
      return decoder.decode(buffer);
    } catch {
      return buffer.toString('utf-8');
    }
  }

  return buffer.toString('utf-8');
}

async function fetch1pondoJson(productId: string): Promise<{
  title?: string;
  description?: string;
  performers?: string[];
  releaseDate?: string;
  thumbnailUrl?: string;
  sampleVideoUrl?: string;
} | null> {
  try {
    const apiUrl = `https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/${productId}.json`;
    const response = await fetch(apiUrl);
    if (!response.ok) return null;
    const json = await response.json();
    return {
      title: json.Title,
      description: json.Desc,
      performers: json.ActressesJa || [],
      releaseDate: json.Release?.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0],
      thumbnailUrl: json.ThumbHigh || json.ThumbUltra || json.ThumbMed,
      sampleVideoUrl: `https://smovie.1pondo.tv/sample/movies/${productId}/1080p.mp4`,
    };
  } catch {
    return null;
  }
}

async function parseHtmlContent(html: string, config: SiteConfig, productId: string): Promise<{
  title?: string;
  description?: string;
  performers?: string[];
  releaseDate?: string;
  thumbnailUrl?: string;
  sampleVideoUrl?: string;
  price?: number;
} | null> {
  if (config.siteName === '一本道') {
    return fetch1pondoJson(productId);
  }

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  let title = titleMatch?.[1] ? titleMatch[1].trim() : undefined;

  const siteSuffixes = [
    /\s*\|\s*カリビアンコムプレミアム$/,
    /\s*\|\s*カリビアンコム$/,
    /\s*\|\s*HEYZO$/,
    /\s*\|\s*一本道$/,
    /\s*-\s*カリビアンコム$/,
    /\s*-\s*HEYZO$/,
  ];
  if (title) {
    for (const suffix of siteSuffixes) {
      title = title.replace(suffix, '').trim();
    }
  }

  const invalidPatterns = [/^一本道$/, /^カリビアンコム$/, /^カリビアンコムプレミアム$/, /^HEYZO$/];
  if (!title || title.length < 3 || invalidPatterns.some(p => p.test(title!))) {
    return null;
  }

  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  const description = descMatch?.[1] ? descMatch[1].trim() : undefined;

  const performers: string[] = [];
  const brandMatch = html.match(/var\s+ec_item_brand\s*=\s*['"]([^'"]+)['"]/);
  if (brandMatch?.[1]) {
    performers.push(brandMatch[1]);
  }

  const dateMatch = html.match(/配信日[:：]?\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
  const releaseDate = dateMatch?.[1] && dateMatch[2] && dateMatch[3]
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : undefined;

  const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
  const thumbnailUrl = imgMatch?.[1];

  let price: number | undefined;
  const priceMatch = html.match(/var\s+ec_price\s*=\s*parseFloat\s*\(\s*['"](\d+(?:\.\d+)?)['"]\s*\)/);
  if (priceMatch?.[1]) {
    price = Math.round(parseFloat(priceMatch[1]) * 150);
  }

  let sampleVideoUrl: string | undefined;
  if (config.siteName === 'カリビアンコム') {
    sampleVideoUrl = `https://www.caribbeancom.com/moviepages/${productId}/sample/sample.mp4`;
  } else if (config.siteName === 'カリビアンコムプレミアム') {
    sampleVideoUrl = `https://www.caribbeancompr.com/moviepages/${productId}/sample/sample.mp4`;
  } else if (config.siteName === 'HEYZO') {
    const paddedId = productId.padStart(4, '0');
    sampleVideoUrl = `https://sample.heyzo.com/contents/3000/${paddedId}/heyzo_hd_${paddedId}_sample.mp4`;
  }

  const result: {
    title?: string;
    description?: string;
    performers?: string[];
    releaseDate?: string;
    thumbnailUrl?: string;
    sampleVideoUrl?: string;
    price?: number;
  } = { title, performers };

  if (description !== undefined) result.description = description;
  if (releaseDate !== undefined) result.releaseDate = releaseDate;
  if (thumbnailUrl !== undefined) result.thumbnailUrl = thumbnailUrl;
  if (sampleVideoUrl !== undefined) result.sampleVideoUrl = sampleVideoUrl;
  if (price !== undefined) result.price = price;

  return result;
}

interface CrawlDtiHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createCrawlDtiHandler(deps: CrawlDtiHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();

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
      const siteKey = url.searchParams.get('site') || '1pondo';
      const startId = url.searchParams.get('start');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const config = SITE_CONFIGS[siteKey];
      if (!config) {
        return NextResponse.json({
          success: false,
          error: `Unknown site: ${siteKey}`,
          availableSites: Object.keys(SITE_CONFIGS),
        }, { status: 400 });
      }

      let currentId = startId || config.defaultStart;
      let consecutiveNotFound = 0;
      const MAX_CONSECUTIVE_NOT_FOUND = 20;

      console.log(`[crawl-dti] Starting: site=${config.siteName}, start=${currentId}, limit=${limit}`);

      // バッチ用: 演者データ収集
      const allPerformerNames = new Set<string>();
      const pendingPerformerLinks: { productId: number; performerNames: string[] }[] = [];

      while (stats.totalFetched < limit) {
        if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
          console.log(`[crawl-dti] Stopping: ${MAX_CONSECUTIVE_NOT_FOUND} consecutive not found`);
          break;
        }

        const pageUrl = config.urlPattern.replace('{id}', currentId);

        try {
          const response = await fetch(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
          });

          if (!response.ok) {
            consecutiveNotFound++;
            const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
            if (!nextId) break;
            currentId = nextId;
            await new Promise(r => setTimeout(r, 500));
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get('content-type') || undefined;
          const html = decodeHtml(buffer, contentType, pageUrl);

          const hash = createHash('sha256').update(html).digest('hex');
          await db.execute(sql`
            INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
            VALUES (${config.siteName}, ${currentId}, ${pageUrl}, ${html}, ${hash})
            ON CONFLICT (source, product_id) DO UPDATE SET
              html_content = EXCLUDED.html_content, hash = EXCLUDED.hash, crawled_at = NOW()
          `);
          stats.rawDataSaved++;

          const productData = await parseHtmlContent(html, config, currentId);
          if (!productData || !productData.title) {
            consecutiveNotFound++;
            const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
            if (!nextId) break;
            currentId = nextId;
            await new Promise(r => setTimeout(r, 500));
            continue;
          }

          consecutiveNotFound = 0;
          stats.totalFetched++;

          console.log(`[crawl-dti] Found: ${currentId} - ${productData.title.substring(0, 40)}...`);

          const normalizedProductId = `${config.siteName}-${currentId}`;
          const affiliateUrl = generateAffiliateUrl(pageUrl);

          const productResult = await db.execute(sql`
            INSERT INTO products (normalized_product_id, title, description, release_date, duration, default_thumbnail_url, updated_at)
            VALUES (${normalizedProductId}, ${productData.title}, ${productData.description || null},
              ${productData.releaseDate ? new Date(productData.releaseDate) : null}, ${null}, ${productData.thumbnailUrl || null}, NOW())
            ON CONFLICT (normalized_product_id) DO UPDATE SET
              title = EXCLUDED.title, description = EXCLUDED.description, release_date = EXCLUDED.release_date,
              default_thumbnail_url = EXCLUDED.default_thumbnail_url, updated_at = NOW()
            RETURNING id
          `);

          const productId = (productResult.rows[0] as { id: number }).id;
          if (productResult.rowCount === 1) stats.newProducts++; else stats.updatedProducts++;

          await db.execute(sql`
            INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url, price, data_source, last_updated)
            VALUES (${productId}, ${config.aspName}, ${currentId}, ${affiliateUrl}, ${productData.price || null}, 'CRAWL', NOW())
            ON CONFLICT (product_id, asp_name) DO UPDATE SET
              affiliate_url = EXCLUDED.affiliate_url, price = EXCLUDED.price, last_updated = NOW()
          `);

          // 出演者をバッチ用に収集
          if (productData.performers && productData.performers.length > 0) {
            for (const name of productData.performers) {
              allPerformerNames.add(name);
            }
            pendingPerformerLinks.push({ productId, performerNames: productData.performers });
          }

          if (productData.sampleVideoUrl) {
            const videoResult = await db.execute(sql`
              INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
              VALUES (${productId}, ${config.aspName}, ${productData.sampleVideoUrl}, 'sample', 0)
              ON CONFLICT DO NOTHING RETURNING id
            `);
            if (videoResult.rowCount && videoResult.rowCount > 0) {
              stats.videosAdded++;
            }
          }

        } catch (error) {
          stats.errors++;
          console.error(`[crawl-dti] Error processing ${currentId}:`, error);
        }

        const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
        if (!nextId) break;
        currentId = nextId;

        await new Promise(r => setTimeout(r, 1000));
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
        message: 'DTI crawl completed',
        params: { site: siteKey, siteName: config.siteName, limit },
        stats,
        duration: `${duration}s`,
      });

    } catch (error) {
      console.error('[crawl-dti] Error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error', stats },
        { status: 500 }
      );
    }
  };
}
