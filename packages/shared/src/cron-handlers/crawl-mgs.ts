/**
 * MGS クローラー ハンドラー
 *
 * MGS動画の商品一覧ページから新着作品を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import type { DbExecutor } from '../db-queries/types';

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
  videosAdded: number;
}

interface MgsProduct {
  productId: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  sampleVideoUrl?: string;
  releaseDate?: string;
  price?: number;
  affiliateWidget: string;
}

const AFFILIATE_CODE = '6CS5PGEBQDUYPZLHYEM33TBZFJ';

function generateAffiliateWidget(productId: string): string {
  const className = createHash('md5').update(productId).digest('hex').substring(0, 8);
  return `<div class="${className}"></div><script id="mgs_Widget_affiliate" type="text/javascript" charset="utf-8" src="https://static.mgstage.com/mgs/script/common/mgs_Widget_affiliate.js?c=${AFFILIATE_CODE}&t=text&o=t&b=t&s=MOMO&p=${productId}&from=ppv&class=${className}"></script>`;
}

async function getProductUrlsFromList(page: number): Promise<string[]> {
  const listUrl = `https://www.mgstage.com/search/cSearch.php?search_word=&sort=new&list_cnt=30&page=${page}`;

  const response = await fetch(listUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': 'adc=1',
    },
  });

  if (!response.ok) return [];

  const html = await response['text']();
  const $ = cheerio.load(html);
  const urls: string[] = [];

  $('a[href*="/product/product_detail/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const fullUrl = href.startsWith('http') ? href : `https://www.mgstage.com${href}`;
      if (!urls.includes(fullUrl)) {
        urls.push(fullUrl);
      }
    }
  });

  return urls;
}

async function parseMgsDetailPage(productUrl: string): Promise<MgsProduct | null> {
  try {
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
      },
    });

    if (!response.ok) return null;

    const html = await response['text']();
    const $ = cheerio.load(html);

    // 商品ID抽出
    const productIdMatch = productUrl.match(/product_detail\/([^\/]+)/);
    if (!productIdMatch || !productIdMatch[1]) return null;
    const productId = productIdMatch[1];

    // タイトル
    const title = $('h1.tag').text().trim() || $('title').text().replace(/ - MGS動画.*$/, '').trim();
    if (!title || title.length < 3) return null;

    // 説明
    const description = $('meta[name="description"]').attr('content') ||
                       $('p.txt.introduction').text().trim();

    // 出演者
    const performers: string[] = [];
    $('th:contains("出演")').next('td').find('a').each((_, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 1 && name.length < 30 &&
          /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(name)) {
        performers.push(name);
      }
    });
    // リンクなしの場合
    if (performers.length === 0) {
      const performerText = $('th:contains("出演")').next('td').text().trim();
      if (performerText) {
        performerText.split(/[、,\n]/).forEach((name) => {
          const trimmed = name.trim();
          if (trimmed && trimmed.length > 1 && trimmed.length < 30 &&
              /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(trimmed)) {
            performers.push(trimmed);
          }
        });
      }
    }

    // サムネイル
    const thumbnailUrl = $('meta[property="og:image"]').attr('content');

    // リリース日
    const releaseDateText = $('th:contains("配信開始日")').next('td').text().trim();
    const releaseDate = releaseDateText ? releaseDateText.replace(/\//g, '-') : undefined;

    // 価格
    let price: number | undefined;
    const priceText = $('th:contains("価格")').next('td').text().trim();
    const priceMatch = priceText.match(/(\d+(?:,\d+)*)/);
    if (priceMatch?.[1]) {
      price = parseInt(priceMatch[1].replace(/,/g, ''));
    }

    // サンプル動画
    let sampleVideoUrl: string | undefined;
    const videoSrc = $('video source').attr('src');
    if (videoSrc) {
      sampleVideoUrl = videoSrc.startsWith('http') ? videoSrc : `https://www.mgstage.com${videoSrc}`;
    }
    if (!sampleVideoUrl) {
      const dataVideoUrl = $('[data-video-url]').attr('data-video-url');
      if (dataVideoUrl) {
        sampleVideoUrl = dataVideoUrl.startsWith('http') ? dataVideoUrl : `https://www.mgstage.com${dataVideoUrl}`;
      }
    }

    return {
      productId,
      title,
      ...(description !== undefined && { description }),
      performers,
      ...(thumbnailUrl !== undefined && { thumbnailUrl }),
      ...(sampleVideoUrl !== undefined && { sampleVideoUrl }),
      ...(releaseDate !== undefined && { releaseDate }),
      ...(price !== undefined && { price }),
      affiliateWidget: generateAffiliateWidget(productId),
    };
  } catch {
    return null;
  }
}

interface CrawlMgsHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createCrawlMgsHandler(deps: CrawlMgsHandlerDeps) {
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
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '30');

      console.log(`[crawl-mgs] Starting: page=${page}, limit=${limit}`);

      // 商品URLリストを取得
      const productUrls = await getProductUrlsFromList(page);
      if (productUrls.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No products found',
          stats,
          duration: '0s',
        });
      }

      console.log(`[crawl-mgs] Found ${productUrls.length} product URLs`);

      for (const productUrl of productUrls.slice(0, limit)) {
        try {
          // 詳細ページをパース
          const product = await parseMgsDetailPage(productUrl);
          if (!product) {
            stats.errors++;
            continue;
          }

          stats.totalFetched++;

          // HTMLを保存
          const htmlResponse = await fetch(productUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Cookie': 'adc=1',
            },
          });
          const html = await htmlResponse.text();
          const hash = createHash('sha256').update(html).digest('hex');

          await db.execute(sql`
            INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
            VALUES ('MGS', ${product['productId']}, ${productUrl}, ${html}, ${hash})
            ON CONFLICT (source, product_id) DO UPDATE SET
              html_content = EXCLUDED.html_content,
              hash = EXCLUDED.hash,
              fetched_at = NOW()
          `);
          stats.rawDataSaved++;

          // 商品データを保存
          const normalizedProductId = product['productId'].toLowerCase();

          const productResult = await db.execute(sql`
            INSERT INTO products (
              normalized_product_id, title, description, release_date,
              default_thumbnail_url, updated_at
            )
            VALUES (
              ${normalizedProductId}, ${product['title']}, ${product['description'] || null},
              ${product['releaseDate'] ? new Date(product['releaseDate']) : null},
              ${product['thumbnailUrl'] || null}, NOW()
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
              ${productId}, 'MGS', ${product['productId']}, ${product.affiliateWidget},
              ${product['price'] || null}, 'CRAWL', NOW()
            )
            ON CONFLICT (product_id, asp_name) DO UPDATE SET
              affiliate_url = EXCLUDED.affiliate_url,
              price = EXCLUDED.price,
              last_updated = NOW()
          `);

          // 出演者
          for (const performerName of product.performers) {
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

          // サンプル動画
          if (product['sampleVideoUrl']) {
            const videoResult = await db.execute(sql`
              INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
              VALUES (${productId}, 'MGS', ${product['sampleVideoUrl']}, 'sample', 0)
              ON CONFLICT DO NOTHING
              RETURNING id
            `);
            if (videoResult.rowCount && videoResult.rowCount > 0) {
              stats.videosAdded++;
            }
          }

          console.log(`[crawl-mgs] Processed: ${product['productId']} - ${product['title'].substring(0, 30)}...`);

          // レート制限
          await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
          stats.errors++;
          console.error(`[crawl-mgs] Error processing URL:`, error);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'MGS crawl completed',
        params: { page, limit },
        stats,
        duration: `${duration}s`,
      });

    } catch (error) {
      console.error('[crawl-mgs] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stats,
        },
        { status: 500 }
      );
    }
  };
}
