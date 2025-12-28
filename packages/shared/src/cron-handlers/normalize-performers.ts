/**
 * Wiki出演者名寄せ ハンドラー
 *
 * 出演者情報がない商品の品番をWikiで検索し、出演者情報を取得・紐付け
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import { normalizePerformerName, parsePerformerNames } from '../lib/performer-validation';
import type { DbExecutor } from '../db-queries/types';

interface Stats {
  totalProcessed: number;
  wikiHits: number;
  performersAdded: number;
  errors: number;
  skipped: number;
}

const RATE_LIMIT_MS = 2000;

/**
 * 品番から検索用のバリエーションを生成
 */
function generateSearchVariants(normalizedProductId: string, originalProductId?: string): string[] {
  const variants: string[] = [];

  if (originalProductId) {
    const cleanId = originalProductId.trim().toUpperCase();

    if (/^[0-9]*[A-Z]{2,10}[-]?\d{2,6}$/i.test(cleanId)) {
      if (cleanId.includes('-')) {
        variants.push(cleanId);
        variants.push(cleanId.replace(/-/g, ''));
      } else {
        variants.push(cleanId);
        const match = cleanId.match(/^(\d*)([A-Z]+)(\d+)$/i);
        if (match) {
          variants.push(`${match[1]}${match[2]}-${match[3]}`);
        }
      }
    }
  }

  const matches = normalizedProductId.match(/([A-Z]{2,10})[-_]?(\d{2,6})/gi);

  if (matches) {
    for (const match of matches) {
      const parts = match.match(/([A-Z]+)[-_]?(\d+)/i);
      if (parts) {
        const prefix = parts[1].toUpperCase();
        const number = parts[2];
        variants.push(`${prefix}-${number}`);
        variants.push(`${prefix}${number}`);
      }
    }
  }

  return [...new Set(variants)];
}

/**
 * みんなのAV で品番検索
 */
async function searchMinnaNoAV(productCode: string): Promise<string[]> {
  try {
    const searchUrl = `https://www.minnano-av.com/search_result.php?search_word=${encodeURIComponent(productCode)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    let movieUrl: string | null = null;
    const productCodeNorm = productCode.toUpperCase().replace(/-/g, '');

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim().toUpperCase().replace(/-/g, '');

      if (href.includes('.html') && !href.includes('actress') && !href.includes('maker')) {
        if (text.includes(productCodeNorm) || href.toUpperCase().includes(productCodeNorm)) {
          movieUrl = href.startsWith('http') ? href : `https://www.minnano-av.com/${href}`;
          return false;
        }
      }
    });

    if (!movieUrl) return [];

    await new Promise(r => setTimeout(r, 1000));

    const detailResponse = await fetch(movieUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!detailResponse.ok) return [];

    const detailHtml = await detailResponse.text();
    const $detail = cheerio.load(detailHtml);

    const performers: string[] = [];

    $detail('a[href*="actress"]').each((_, el) => {
      const name = $detail(el).text().trim();
      if (name &&
          name.length > 1 &&
          name.length < 30 &&
          /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(name) &&
          !name.includes('女優') &&
          !name.includes('一覧') &&
          !name.includes('ランキング')) {
        performers.push(name);
      }
    });

    return [...new Set(performers)];
  } catch {
    return [];
  }
}

/**
 * AV-Wiki で品番検索
 */
async function searchAVWiki(productCode: string): Promise<string[]> {
  try {
    const searchUrl = `https://av-wiki.net/?s=${encodeURIComponent(productCode)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    const performers: string[] = [];

    $('a[href*="/av-actress/"]').each((_, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 1 && name.length < 30) {
        performers.push(name);
      }
    });

    $('td:contains("出演者"), td:contains("女優")').next().each((_, el) => {
      const text = $(el).text().trim();
      const names = text.split(/[,、/]/).map(n => n.trim()).filter(n => n.length > 1 && n.length < 30);
      performers.push(...names);
    });

    return [...new Set(performers)];
  } catch {
    return [];
  }
}

interface GoogleApiConfig {
  customSearch: boolean;
  naturalLanguage: boolean;
}

interface CustomSearchResult {
  items?: Array<{ title: string; snippet: string }>;
}

interface NormalizePerformersHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
  customSearch?: (query: string, options: any) => Promise<CustomSearchResult | null>;
  extractPerformerNames?: (text: string) => Promise<string[]>;
  checkGoogleApiConfig?: () => GoogleApiConfig;
}

/**
 * ルックアップテーブルから出演者情報を取得
 */
async function fetchFromLookupTable(
  db: ReturnType<NormalizePerformersHandlerDeps['getDb']>,
  productCode: string
): Promise<{ performers: string[]; source: string } | null> {
  try {
    const normalized = productCode.toUpperCase().replace(/[-_\s]/g, '');

    const result = await db.execute(sql`
      SELECT performer_names, source
      FROM product_performer_lookup
      WHERE product_code_normalized = ${normalized}
      ORDER BY
        CASE source
          WHEN 'minnano-av' THEN 1
          WHEN 'av-wiki' THEN 2
          WHEN 'seesaawiki' THEN 3
          WHEN 'nakiny' THEN 4
          WHEN 'av-sommelier' THEN 5
          WHEN 'shirouto-matome' THEN 6
          ELSE 7
        END
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const row = result.rows[0] as { performer_names: string[]; source: string };
      if (row.performer_names && row.performer_names.length > 0) {
        return {
          performers: row.performer_names,
          source: `lookup:${row.source}`,
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`[normalize-performers] Lookup error for ${productCode}:`, error);
    return null;
  }
}

/**
 * 検索結果をルックアップテーブルに保存
 */
async function saveToLookupTable(
  db: ReturnType<NormalizePerformersHandlerDeps['getDb']>,
  productCode: string,
  performers: string[],
  source: string
): Promise<void> {
  try {
    const normalized = productCode.toUpperCase().replace(/[-_\s]/g, '');

    await db.execute(sql`
      INSERT INTO product_performer_lookup (
        product_code,
        product_code_normalized,
        performer_names,
        source,
        crawled_at
      )
      VALUES (
        ${productCode},
        ${normalized},
        ${performers},
        ${source},
        NOW()
      )
      ON CONFLICT (product_code_normalized, source)
      DO UPDATE SET
        performer_names = EXCLUDED.performer_names,
        crawled_at = NOW()
    `);

    console.log(`[normalize-performers] Saved to lookup: ${productCode} (${source})`);
  } catch (error) {
    console.error(`[normalize-performers] Lookup save error for ${productCode}:`, error);
  }
}

/**
 * 複数ソースから出演者情報を取得
 */
async function fetchPerformersFromWiki(
  productCode: string,
  db?: ReturnType<NormalizePerformersHandlerDeps['getDb']>,
): Promise<{ performers: string[]; source: string } | null> {
  const variants = [productCode];

  if (productCode.includes('-')) {
    variants.push(productCode.replace(/-/g, ''));
  } else {
    const match = productCode.match(/^([A-Z]+)(\d+)$/i);
    if (match) {
      variants.push(`${match[1]}-${match[2]}`);
    }
  }

  // 1. まずルックアップテーブルを検索
  if (db) {
    for (const variant of variants) {
      const lookupResult = await fetchFromLookupTable(db, variant);
      if (lookupResult) {
        return lookupResult;
      }
    }
  }

  // 2. Web検索
  for (const variant of variants) {
    let performers = await searchMinnaNoAV(variant);
    if (performers.length > 0) {
      if (db) {
        await saveToLookupTable(db, variant, performers, 'minnano-av');
      }
      return { performers, source: 'minnano-av' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

    performers = await searchAVWiki(variant);
    if (performers.length > 0) {
      if (db) {
        await saveToLookupTable(db, variant, performers, 'av-wiki');
      }
      return { performers, source: 'av-wiki' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  return null;
}

/**
 * 出演者をDBに登録・紐付け
 */
async function linkPerformerToProduct(
  db: ReturnType<NormalizePerformersHandlerDeps['getDb']>,
  productId: number,
  performerName: string
): Promise<boolean> {
  try {
    const normalized = normalizePerformerName(performerName);
    if (!normalized) {
      console.log(`[normalize-performers] Skipped invalid name: "${performerName}"`);
      return false;
    }

    const performerResult = await db.execute(sql`
      INSERT INTO performers (name)
      VALUES (${normalized})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);

    const performerId = (performerResult.rows[0] as { id: number }).id;

    await db.execute(sql`
      INSERT INTO product_performers (product_id, performer_id)
      VALUES (${productId}, ${performerId})
      ON CONFLICT DO NOTHING
    `);

    return true;
  } catch (error) {
    console.error(`Error linking performer ${performerName}:`, error);
    return false;
  }
}

export function createNormalizePerformersHandler(deps: NormalizePerformersHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();

    const stats: Stats = {
      totalProcessed: 0,
      wikiHits: 0,
      performersAdded: 0,
      errors: 0,
      skipped: 0,
    };

    try {
      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const aspFilter = url.searchParams.get('asp') || null;

      console.log(`[normalize-performers] Starting: asp=${aspFilter || 'all'}, limit=${limit}, offset=${offset}`);

      let productsResult;

      if (aspFilter) {
        productsResult = await db.execute(sql`
          SELECT DISTINCT ON (p.id) p.id, p.normalized_product_id, p.title, ps.asp_name, ps.original_product_id
          FROM products p
          INNER JOIN product_sources ps ON p.id = ps.product_id
          LEFT JOIN product_performers pp ON p.id = pp.product_id
          WHERE pp.product_id IS NULL
            AND ps.asp_name = ${aspFilter}
          ORDER BY p.id
          LIMIT ${limit}
          OFFSET ${offset}
        `);
      } else {
        productsResult = await db.execute(sql`
          SELECT DISTINCT ON (p.id) p.id, p.normalized_product_id, p.title, ps.asp_name, ps.original_product_id
          FROM products p
          INNER JOIN product_sources ps ON p.id = ps.product_id
          LEFT JOIN product_performers pp ON p.id = pp.product_id
          WHERE pp.product_id IS NULL
          ORDER BY p.id
          LIMIT ${limit}
          OFFSET ${offset}
        `);
      }

      const products = productsResult.rows as Array<{
        id: number;
        normalized_product_id: string;
        title: string;
        asp_name: string;
        original_product_id: string;
      }>;

      console.log(`[normalize-performers] Found ${products.length} products to process`);

      for (const product of products) {
        stats.totalProcessed++;

        const variants = generateSearchVariants(product.normalized_product_id, product.original_product_id);

        if (variants.length === 0) {
          console.log(`[normalize-performers] Skip: ${product.normalized_product_id} - no variants`);
          stats.skipped++;
          continue;
        }

        console.log(`[normalize-performers] Processing: ${product.normalized_product_id} variants=${variants.join(',')}`);

        let result: { performers: string[]; source: string } | null = null;
        for (const variant of variants) {
          result = await fetchPerformersFromWiki(variant, db);
          if (result) break;
        }

        if (!result || result.performers.length === 0) {
          console.log(`[normalize-performers] No wiki hit: ${product.normalized_product_id}`);
          continue;
        }

        console.log(`[normalize-performers] Hit (${result.source}): ${product.normalized_product_id} -> ${result.performers.join(', ')}`);
        stats.wikiHits++;

        for (const rawPerformerName of result.performers) {
          const splitNames = parsePerformerNames(rawPerformerName, /[、,\/・\n\t\s　]+/);

          if (splitNames.length === 0) {
            const success = await linkPerformerToProduct(db, product.id, rawPerformerName);
            if (success) {
              stats.performersAdded++;
            }
          } else {
            for (const performerName of splitNames) {
              const success = await linkPerformerToProduct(db, product.id, performerName);
              if (success) {
                stats.performersAdded++;
              }
            }
          }
        }

        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'Performer normalization completed',
        params: { asp: aspFilter, limit, offset },
        stats,
        duration: `${duration}s`,
      });

    } catch (error) {
      console.error('[normalize-performers] Error:', error);
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
