/**
 * DTI クローラー API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * DTI系サイト（カリビアンコム、一本道、HEYZO等）をクロール
 * GET /api/cron/crawl-dti?site=1pondo&start=112024_001&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { detectEncoding, decodeHtml, generateNextId } from '@/lib/providers/dti-base';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分タイムアウト

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
    siteId: '2478',
    baseUrl: 'https://www.caribbeancom.com',
    urlPattern: 'https://www.caribbeancom.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    defaultStart: '112924_001',
    reverseMode: true,
  },
  'caribbeancompr': {
    siteName: 'カリビアンコムプレミアム',
    siteId: '2477',
    baseUrl: 'https://www.caribbeancompr.com',
    urlPattern: 'https://www.caribbeancompr.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    defaultStart: '112924_001',
    reverseMode: true,
  },
  '1pondo': {
    siteName: '一本道',
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
    siteId: '2665',
    baseUrl: 'https://www.heyzo.com',
    urlPattern: 'https://www.heyzo.com/moviepages/{id}/index.html',
    idFormat: 'NNNN',
    defaultStart: '3500',
    reverseMode: false,
  },
  '10musume': {
    siteName: '天然むすめ',
    siteId: '2471',
    baseUrl: 'https://www.10musume.com',
    urlPattern: 'https://www.10musume.com/moviepages/{id}/index.html',
    idFormat: 'MMDDYY_NNN',
    defaultStart: '112924_001',
    reverseMode: true,
  },
  'pacopacomama': {
    siteName: 'パコパコママ',
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
  // 一本道はJSON APIを使用
  if (config.siteName === '一本道') {
    return fetch1pondoJson(productId);
  }

  // タイトル抽出
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : undefined;

  // サイト名を除去
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

  // 無効なタイトルをスキップ
  const invalidPatterns = [/^一本道$/, /^カリビアンコム$/, /^カリビアンコムプレミアム$/, /^HEYZO$/];
  if (!title || title.length < 3 || invalidPatterns.some(p => p.test(title!))) {
    return null;
  }

  // 説明抽出
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  const description = descMatch ? descMatch[1].trim() : undefined;

  // 出演者抽出
  const performers: string[] = [];
  const brandMatch = html.match(/var\s+ec_item_brand\s*=\s*['"]([^'"]+)['"]/);
  if (brandMatch && brandMatch[1]) {
    performers.push(brandMatch[1]);
  }

  // 日付抽出
  const dateMatch = html.match(/配信日[:：]?\s*(\d{4})[年\/-](\d{1,2})[月\/-](\d{1,2})/);
  const releaseDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : undefined;

  // サムネイル抽出
  const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
  const thumbnailUrl = imgMatch ? imgMatch[1] : undefined;

  // 価格抽出
  let price: number | undefined;
  const priceMatch = html.match(/var\s+ec_price\s*=\s*parseFloat\s*\(\s*['"](\d+(?:\.\d+)?)['"]\s*\)/);
  if (priceMatch) {
    price = Math.round(parseFloat(priceMatch[1]) * 150);
  }

  // サンプル動画URL
  let sampleVideoUrl: string | undefined;
  if (config.siteName === 'カリビアンコム') {
    sampleVideoUrl = `https://www.caribbeancom.com/moviepages/${productId}/sample/sample.mp4`;
  } else if (config.siteName === 'カリビアンコムプレミアム') {
    sampleVideoUrl = `https://www.caribbeancompr.com/moviepages/${productId}/sample/sample.mp4`;
  } else if (config.siteName === 'HEYZO') {
    sampleVideoUrl = `https://www.heyzo.com/moviepages/${productId}/sample/sample.mp4`;
  }

  return { title, description, performers, releaseDate, thumbnailUrl, sampleVideoUrl, price };
}

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const db = getDb();
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
    const url = new URL(request.url);
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

        // HTMLを保存
        const hash = createHash('sha256').update(html).digest('hex');
        await db.execute(sql`
          INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
          VALUES (${config.siteName}, ${currentId}, ${pageUrl}, ${html}, ${hash})
          ON CONFLICT (source, product_id) DO UPDATE SET
            html_content = EXCLUDED.html_content,
            hash = EXCLUDED.hash,
            crawled_at = NOW()
        `);
        stats.rawDataSaved++;

        // パース
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

        // DB保存
        const normalizedProductId = `${config.siteName}-${currentId}`;
        const affiliateUrl = generateAffiliateUrl(pageUrl);

        const productResult = await db.execute(sql`
          INSERT INTO products (
            normalized_product_id, title, description, release_date, duration,
            default_thumbnail_url, updated_at
          )
          VALUES (
            ${normalizedProductId}, ${productData.title}, ${productData.description || null},
            ${productData.releaseDate ? new Date(productData.releaseDate) : null}, ${null},
            ${productData.thumbnailUrl || null}, NOW()
          )
          ON CONFLICT (normalized_product_id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            release_date = EXCLUDED.release_date,
            default_thumbnail_url = EXCLUDED.default_thumbnail_url,
            updated_at = NOW()
          RETURNING id
        `);

        const productId = (productResult.rows[0] as { id: number }).id;
        if (productResult.rowCount === 1) {
          stats.newProducts++;
        } else {
          stats.updatedProducts++;
        }

        // product_sources
        await db.execute(sql`
          INSERT INTO product_sources (
            product_id, asp_name, original_product_id, affiliate_url, price, data_source, last_updated
          )
          VALUES (
            ${productId}, 'DTI', ${currentId}, ${affiliateUrl},
            ${productData.price || null}, 'CRAWL', NOW()
          )
          ON CONFLICT (product_id, asp_name) DO UPDATE SET
            affiliate_url = EXCLUDED.affiliate_url,
            price = EXCLUDED.price,
            last_updated = NOW()
        `);

        // 出演者
        if (productData.performers && productData.performers.length > 0) {
          for (const performerName of productData.performers) {
            const performerResult = await db.execute(sql`
              INSERT INTO performers (name) VALUES (${performerName})
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `);
            const performerId = (performerResult.rows[0] as { id: number }).id;
            await db.execute(sql`
              INSERT INTO product_performers (product_id, performer_id)
              VALUES (${productId}, ${performerId})
              ON CONFLICT DO NOTHING
            `);
          }
        }

        // サンプル動画
        if (productData.sampleVideoUrl) {
          const videoResult = await db.execute(sql`
            INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
            VALUES (${productId}, 'DTI', ${productData.sampleVideoUrl}, 'sample', 0)
            ON CONFLICT DO NOTHING
            RETURNING id
          `);
          if (videoResult.rowCount && videoResult.rowCount > 0) {
            stats.videosAdded++;
          }
        }

      } catch (error) {
        stats.errors++;
        console.error(`[crawl-dti] Error processing ${currentId}:`, error);
      }

      // 次のID
      const nextId = generateNextId(currentId, config.idFormat, config.reverseMode);
      if (!nextId) break;
      currentId = nextId;

      // レート制限
      await new Promise(r => setTimeout(r, 1000));
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
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
      },
      { status: 500 }
    );
  }
}
