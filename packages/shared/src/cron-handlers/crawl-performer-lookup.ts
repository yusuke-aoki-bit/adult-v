/**
 * Performer Lookup 一括クロール ハンドラー
 *
 * 各検索ソースをクロールして商品番号→女優名のマッピングを作成
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const RATE_LIMIT_MS = 1500;

interface CrawlStats {
  source: string;
  page: number;
  itemsCrawled: number;
  itemsInserted: number;
  itemsUpdated: number;
  errors: number;
}

interface LookupEntry {
  productCode: string;
  productCodeNormalized: string;
  performerNames: string[];
  title?: string;
  sourceUrl?: string;
}

function normalizeProductCode(code: string): string {
  return code.toUpperCase().replace(/[-_\s]/g, '');
}

function isValidPerformerName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 30) return false;
  if (!/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z・]+$/.test(name)) return false;
  const excludePatterns = [
    '素人', 'ナンパ', '企画', 'AV', '動画', 'サンプル', '無料',
    '高画質', 'HD', '4K', 'VR', 'カテゴリ', 'タグ', 'ジャンル',
    '人気', 'ランキング', '新着', '特集', 'セール', '配信',
    'page', 'Page', 'PAGE', 'next', 'prev'
  ];
  return !excludePatterns.some(p => name.includes(p));
}

async function crawlNakiny(page: number): Promise<LookupEntry[]> {
  const entries: LookupEntry[] = [];

  try {
    const url = `https://nakiny.com/page/${page}/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return entries;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('article, .post, .entry').each((_, article) => {
      const $article = $(article);
      const titleEl = $article.find('h2 a, .entry-title a').first();
      const title = titleEl.text().trim();
      const sourceUrl = titleEl.attr('href') || '';

      const productCodeMatch = title.match(/([A-Z]{2,6}[-_]?\d{3,5})/i);
      if (!productCodeMatch) return;

      const productCode = productCodeMatch[1].toUpperCase();
      const performers: string[] = [];

      $article.find('a[rel="tag"], .tag-links a, a[href*="/tag/"], a[href*="/actress/"]').each((_, el) => {
        const name = $(el).text().trim();
        if (isValidPerformerName(name)) {
          performers.push(name);
        }
      });

      const bracketMatch = title.match(/【([^】]+)】/);
      if (bracketMatch) {
        bracketMatch[1].split(/[,、・]/).forEach(n => {
          const name = n.trim();
          if (isValidPerformerName(name)) {
            performers.push(name);
          }
        });
      }

      if (performers.length > 0) {
        entries.push({
          productCode,
          productCodeNormalized: normalizeProductCode(productCode),
          performerNames: [...new Set(performers)],
          title,
          sourceUrl,
        });
      }
    });

  } catch (error) {
    console.error(`[crawl-performer-lookup] nakiny page ${page} error:`, error);
  }

  return entries;
}

async function crawlAVSommelier(page: number): Promise<LookupEntry[]> {
  const entries: LookupEntry[] = [];

  try {
    const url = `https://avsommelier.net/page/${page}/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return entries;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('article, .entry, .post').each((_, article) => {
      const $article = $(article);
      const titleEl = $article.find('h2 a, .entry-title a').first();
      const title = titleEl.text().trim();
      const sourceUrl = titleEl.attr('href') || '';

      const productCodeMatch = title.match(/([A-Z]{2,6}[-_]?\d{3,5})/i);
      if (!productCodeMatch) return;

      const productCode = productCodeMatch[1].toUpperCase();
      const performers: string[] = [];

      $article.find('a[rel="tag"], .tag-links a, a[href*="/tag/"]').each((_, el) => {
        const name = $(el).text().trim();
        if (isValidPerformerName(name)) {
          performers.push(name);
        }
      });

      $article.find('.entry-meta, .post-meta').each((_, meta) => {
        const text = $(meta).text();
        const actressMatch = text.match(/出演[：:]\s*([^/\n]+)/);
        if (actressMatch) {
          actressMatch[1].split(/[,、・]/).forEach(n => {
            const name = n.trim();
            if (isValidPerformerName(name)) {
              performers.push(name);
            }
          });
        }
      });

      if (performers.length > 0) {
        entries.push({
          productCode,
          productCodeNormalized: normalizeProductCode(productCode),
          performerNames: [...new Set(performers)],
          title,
          sourceUrl,
        });
      }
    });

  } catch (error) {
    console.error(`[crawl-performer-lookup] av-sommelier page ${page} error:`, error);
  }

  return entries;
}

async function crawlShiroutoMatome(page: number): Promise<LookupEntry[]> {
  const entries: LookupEntry[] = [];

  try {
    const url = `https://shiroutomatome.com/page/${page}/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return entries;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('article, .entry, .post').each((_, article) => {
      const $article = $(article);
      const titleEl = $article.find('h2 a, .entry-title a').first();
      const title = titleEl.text().trim();
      const sourceUrl = titleEl.attr('href') || '';

      const productCodeMatch = title.match(/([A-Z]{2,6}[-_]?\d{3,5})/i);
      if (!productCodeMatch) return;

      const productCode = productCodeMatch[1].toUpperCase();
      const performers: string[] = [];

      const bracketMatch = title.match(/【([^】]+)】/);
      if (bracketMatch) {
        bracketMatch[1].split(/[,、・]/).forEach(n => {
          const name = n.trim();
          if (isValidPerformerName(name)) {
            performers.push(name);
          }
        });
      }

      const nameMatch = title.match(/^([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,10})\s+[A-Z]/);
      if (nameMatch && isValidPerformerName(nameMatch[1])) {
        performers.push(nameMatch[1]);
      }

      if (performers.length > 0) {
        entries.push({
          productCode,
          productCodeNormalized: normalizeProductCode(productCode),
          performerNames: [...new Set(performers)],
          title,
          sourceUrl,
        });
      }
    });

  } catch (error) {
    console.error(`[crawl-performer-lookup] shirouto-matome page ${page} error:`, error);
  }

  return entries;
}

async function crawlMinnanoAV(page: number): Promise<LookupEntry[]> {
  const entries: LookupEntry[] = [];

  try {
    const url = `https://www.minnano-av.com/newlist.php?p=${page}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return entries;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('tr, .item, .video-item').each((_, item) => {
      const $item = $(item);
      const title = $item.find('a[href*="product"]').first().text().trim();
      const sourceUrl = $item.find('a[href*="product"]').first().attr('href') || '';

      const productCodeMatch = title.match(/([A-Z]{2,6}[-_]?\d{3,5})/i) ||
                               sourceUrl.match(/product=([A-Z0-9-]+)/i);
      if (!productCodeMatch) return;

      const productCode = productCodeMatch[1].toUpperCase();
      const performers: string[] = [];

      $item.find('a[href*="actress"]').each((_, el) => {
        const name = $(el).text().trim();
        if (isValidPerformerName(name)) {
          performers.push(name);
        }
      });

      if (performers.length > 0) {
        entries.push({
          productCode,
          productCodeNormalized: normalizeProductCode(productCode),
          performerNames: [...new Set(performers)],
          title,
          sourceUrl: sourceUrl.startsWith('http') ? sourceUrl : `https://www.minnano-av.com${sourceUrl}`,
        });
      }
    });

  } catch (error) {
    console.error(`[crawl-performer-lookup] minnano-av page ${page} error:`, error);
  }

  return entries;
}

async function crawlSeesaaWiki(page: number): Promise<LookupEntry[]> {
  const entries: LookupEntry[] = [];

  try {
    const url = `https://seesaawiki.jp/av_neme/d/%c9%ca%c8%d6?page=${page}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return entries;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('a[href*="/d/"]').each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href') || '';

      const productCodeMatch = text.match(/^([A-Z]{2,6}[-_]?\d{3,5})$/i);
      if (productCodeMatch) {
        const productCode = productCodeMatch[1].toUpperCase();
        entries.push({
          productCode,
          productCodeNormalized: normalizeProductCode(productCode),
          performerNames: [],
          sourceUrl: href.startsWith('http') ? href : `https://seesaawiki.jp${href}`,
        });
      }
    });

  } catch (error) {
    console.error(`[crawl-performer-lookup] seesaawiki page ${page} error:`, error);
  }

  return entries;
}

async function crawlAVWiki(page: number): Promise<LookupEntry[]> {
  const entries: LookupEntry[] = [];

  try {
    const url = `https://av-wiki.net/?page=${page}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return entries;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('tr, .item').each((_, item) => {
      const $item = $(item);
      const title = $item.find('a').first().text().trim();
      const sourceUrl = $item.find('a').first().attr('href') || '';

      const productCodeMatch = title.match(/([A-Z]{2,6}[-_]?\d{3,5})/i);
      if (!productCodeMatch) return;

      const productCode = productCodeMatch[1].toUpperCase();
      const performers: string[] = [];

      $item.find('td').each((_, td) => {
        const text = $(td).text().trim();
        if (text.length > 1 && text.length < 30 && isValidPerformerName(text)) {
          performers.push(text);
        }
      });

      if (performers.length > 0) {
        entries.push({
          productCode,
          productCodeNormalized: normalizeProductCode(productCode),
          performerNames: [...new Set(performers)],
          title,
          sourceUrl,
        });
      }
    });

  } catch (error) {
    console.error(`[crawl-performer-lookup] av-wiki page ${page} error:`, error);
  }

  return entries;
}

interface CrawlPerformerLookupHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => { execute: (query: any) => Promise<{ rows: any[]; rowCount: number | null }> };
}

async function saveEntries(
  db: ReturnType<CrawlPerformerLookupHandlerDeps['getDb']>,
  entries: LookupEntry[],
  source: string
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const entry of entries) {
    if (entry.performerNames.length === 0) continue;

    try {
      const result = await db.execute(sql`
        INSERT INTO product_performer_lookup (
          product_code, product_code_normalized, performer_names,
          source, title, source_url, crawled_at
        )
        VALUES (
          ${entry.productCode}, ${entry.productCodeNormalized}, ${entry.performerNames},
          ${source}, ${entry.title || null}, ${entry.sourceUrl || null}, NOW()
        )
        ON CONFLICT (product_code_normalized, source)
        DO UPDATE SET
          performer_names = EXCLUDED.performer_names,
          title = COALESCE(EXCLUDED.title, product_performer_lookup.title),
          source_url = COALESCE(EXCLUDED.source_url, product_performer_lookup.source_url),
          crawled_at = NOW()
        RETURNING (xmax = 0) as is_insert
      `);

      const isInsert = (result.rows[0] as { is_insert: boolean })?.is_insert;
      if (isInsert) {
        inserted++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`[crawl-performer-lookup] Error saving entry ${entry.productCode}:`, error);
    }
  }

  return { inserted, updated };
}

export function createCrawlPerformerLookupHandler(deps: CrawlPerformerLookupHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const url = new URL(request.url);
    const source = url.searchParams.get('source') || 'nakiny';
    const page = parseInt(url.searchParams.get('page') || '1');
    const pages = parseInt(url.searchParams.get('pages') || '10');

    const stats: CrawlStats = {
      source,
      page,
      itemsCrawled: 0,
      itemsInserted: 0,
      itemsUpdated: 0,
      errors: 0,
    };

    console.log(`[crawl-performer-lookup] Starting: source=${source}, page=${page}, pages=${pages}`);

    try {
      const crawlFunctions: Record<string, (page: number) => Promise<LookupEntry[]>> = {
        'nakiny': crawlNakiny,
        'av-sommelier': crawlAVSommelier,
        'shirouto-matome': crawlShiroutoMatome,
        'minnano-av': crawlMinnanoAV,
        'av-wiki': crawlAVWiki,
        'seesaawiki': crawlSeesaaWiki,
      };

      const crawlFn = crawlFunctions[source];
      if (!crawlFn) {
        return NextResponse.json({
          success: false,
          error: `Unknown source: ${source}. Available: ${Object.keys(crawlFunctions).join(', ')}`,
        }, { status: 400 });
      }

      for (let p = page; p < page + pages; p++) {
        console.log(`[crawl-performer-lookup] Crawling ${source} page ${p}...`);

        const entries = await crawlFn(p);
        stats.itemsCrawled += entries.length;

        if (entries.length > 0) {
          const { inserted, updated } = await saveEntries(db, entries, source);
          stats.itemsInserted += inserted;
          stats.itemsUpdated += updated;
        }

        if (p < page + pages - 1) {
          await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
        }
      }

      const lookupStats = await db.execute(sql`
        SELECT
          source,
          COUNT(*) as count,
          COUNT(DISTINCT product_code_normalized) as unique_products
        FROM product_performer_lookup
        GROUP BY source
        ORDER BY count DESC
      `);

      return NextResponse.json({
        success: true,
        message: `Crawled ${source} pages ${page}-${page + pages - 1}`,
        stats,
        lookupTableStats: lookupStats.rows,
      });

    } catch (error) {
      console.error('[crawl-performer-lookup] Error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
      }, { status: 500 });
    }
  };
}
