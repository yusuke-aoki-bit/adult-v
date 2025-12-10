/**
 * Wiki出演者名寄せ Cron API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * 出演者情報がない商品の品番をWikiで検索し、出演者情報を取得・紐付け
 *
 * GET /api/cron/normalize-performers?asp=MGS&limit=50&offset=0
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import {
  customSearch,
  extractPerformerNames,
  checkGoogleApiConfig,
} from '@/lib/google-apis';
import {
  normalizePerformerName,
  parsePerformerNames,
} from '@/lib/performer-validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分タイムアウト

interface Stats {
  totalProcessed: number;
  wikiHits: number;
  performersAdded: number;
  errors: number;
  skipped: number;
}

const RATE_LIMIT_MS = 2000; // 2秒間隔

/**
 * 品番から検索用のバリエーションを生成
 */
function generateSearchVariants(normalizedProductId: string, originalProductId?: string): string[] {
  const variants: string[] = [];

  // originalProductId が標準品番形式ならそれを優先
  if (originalProductId) {
    const cleanId = originalProductId.trim().toUpperCase();

    // 標準品番形式: ABC-123 or ABC123 or 300ABC123
    if (/^[0-9]*[A-Z]{2,10}[-]?\d{2,6}$/i.test(cleanId)) {
      // ハイフンあり・なし両方
      if (cleanId.includes('-')) {
        variants.push(cleanId);
        variants.push(cleanId.replace(/-/g, ''));
      } else {
        variants.push(cleanId);
        // ABC123 → ABC-123 or 300ABC123 → 300ABC-123
        const match = cleanId.match(/^(\d*)([A-Z]+)(\d+)$/i);
        if (match) {
          variants.push(`${match[1]}${match[2]}-${match[3]}`);
        }
      }
    }
  }

  // normalized_product_id から品番を抽出
  // パターン: STUDIO-ABC-123, ABC-123-PPV など
  const matches = normalizedProductId.match(/([A-Z]{2,10})[-_]?(\d{2,6})/gi);

  if (matches) {
    for (const match of matches) {
      const parts = match.match(/([A-Z]+)[-_]?(\d+)/i);
      if (parts) {
        const prefix = parts[1].toUpperCase();
        const number = parts[2];

        // ハイフンあり・なし両方
        variants.push(`${prefix}-${number}`);
        variants.push(`${prefix}${number}`);
      }
    }
  }

  return [...new Set(variants)];
}

/**
 * みんなのAV で品番検索（最も信頼性が高い）
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

    // 検索結果から作品詳細ページへのリンクを探す
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

    // 作品詳細ページにアクセス
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

/**
 * Seesaa Wiki で品番検索
 */
async function searchSeesaaWiki(productCode: string): Promise<string[]> {
  try {
    const searchUrl = `https://seesaawiki.jp/av_neme/search?keywords=${encodeURIComponent(productCode)}`;

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

    $('.search-result a').each((_, el) => {
      const title = $(el).text().trim();
      if (title && /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+$/.test(title)) {
        if (title.length > 1 && title.length < 30) {
          performers.push(title);
        }
      }
    });

    return [...new Set(performers)];
  } catch {
    return [];
  }
}

/**
 * nakiny (素人系AV女優データベース) で品番検索
 */
async function searchNakiny(productCode: string): Promise<string[]> {
  try {
    const searchUrl = `https://nakiny.com/?s=${encodeURIComponent(productCode)}`;

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
    const productCodeNorm = productCode.toUpperCase().replace(/-/g, '');

    // 検索結果から作品を探す
    $('article, .post, .entry').each((_, article) => {
      const articleText = $(article).text().toUpperCase().replace(/-/g, '');
      if (articleText.includes(productCodeNorm)) {
        // 出演者リンクを探す
        $(article).find('a[href*="/tag/"], a[href*="/actress/"], a[href*="/category/"]').each((_, el) => {
          const name = $(el).text().trim();
          if (name &&
              name.length > 1 &&
              name.length < 30 &&
              /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(name) &&
              !name.includes('素人') &&
              !name.includes('ナンパ') &&
              !name.includes('企画')) {
            performers.push(name);
          }
        });
      }
    });

    return [...new Set(performers)];
  } catch {
    return [];
  }
}

/**
 * AVソムリエ で品番検索
 */
async function searchAVSommelier(productCode: string): Promise<string[]> {
  try {
    const searchUrl = `https://avsommelier.net/?s=${encodeURIComponent(productCode)}`;

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
    const productCodeNorm = productCode.toUpperCase().replace(/-/g, '');

    // 検索結果の各記事をチェック
    $('article, .entry, .post').each((_, article) => {
      const title = $(article).find('h2, .entry-title').text().toUpperCase().replace(/-/g, '');
      if (title.includes(productCodeNorm)) {
        // 出演者情報を探す
        $(article).find('a[rel="tag"], .tag-links a, a[href*="/tag/"]').each((_, el) => {
          const name = $(el).text().trim();
          if (name &&
              name.length > 1 &&
              name.length < 30 &&
              /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(name) &&
              !name.includes('AV') &&
              !name.includes('動画')) {
            performers.push(name);
          }
        });
      }
    });

    // メタデータからも抽出
    $('th:contains("出演"), th:contains("女優"), td:contains("出演者")').next('td').each((_, el) => {
      const text = $(el).text().trim();
      const names = text.split(/[,、/／]/).map(n => n.trim()).filter(n =>
        n.length > 1 &&
        n.length < 30 &&
        /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(n)
      );
      performers.push(...names);
    });

    return [...new Set(performers)];
  } catch {
    return [];
  }
}

/**
 * Google Custom Search API で品番検索（Cloudflare ブロック回避）
 * Wikipedia、みんなのAV等の信頼できるサイトを検索
 */
async function searchGoogleCustomSearch(productCode: string): Promise<string[]> {
  const apiConfig = checkGoogleApiConfig();
  if (!apiConfig.customSearch) {
    console.log('[normalize-performers] Google Custom Search API not configured');
    return [];
  }

  try {
    // 品番 + "出演" で検索して出演者情報を含むページを探す
    const query = `${productCode} AV 出演者`;
    const result = await customSearch(query, {
      num: 5,
      language: 'lang_ja',
    });

    if (!result || !result.items || result.items.length === 0) {
      return [];
    }

    const performers: string[] = [];

    for (const item of result.items) {
      const text = `${item.title} ${item.snippet}`;

      // 検索結果のスニペットから人名らしい文字列を抽出
      // パターン1: 「出演：名前」「出演者：名前」形式
      const castMatch = text.match(/出演[者]?[：:]\s*([^\s,、]+(?:[,、\s]+[^\s,、]+)*)/);
      if (castMatch) {
        const names = castMatch[1].split(/[,、\s]+/).filter(n =>
          n.length >= 2 &&
          n.length <= 20 &&
          /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(n) &&
          !n.includes('女優') &&
          !n.includes('出演')
        );
        performers.push(...names);
      }

      // パターン2: Wikipedia形式「名前（よみがな）」
      const wikiMatch = text.match(/([\u4E00-\u9FAF]{2,8})\s*[（(][ぁ-ゖー]+[）)]/g);
      if (wikiMatch) {
        for (const match of wikiMatch) {
          const name = match.match(/([\u4E00-\u9FAF]{2,8})/);
          if (name) performers.push(name[1]);
        }
      }

      // パターン3: 【名前】形式（まとめサイトによくある）
      const bracketMatch = text.match(/【([^\】]{2,15})】/g);
      if (bracketMatch) {
        for (const match of bracketMatch) {
          const name = match.replace(/[【】]/g, '');
          if (
            name.length >= 2 &&
            name.length <= 15 &&
            /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(name) &&
            !name.includes('無料') &&
            !name.includes('動画') &&
            !name.includes('AV')
          ) {
            performers.push(name);
          }
        }
      }
    }

    return [...new Set(performers)];
  } catch (error) {
    console.error('[normalize-performers] Google Custom Search error:', error);
    return [];
  }
}

/**
 * Natural Language API でタイトルから出演者名を抽出
 */
async function extractPerformersFromTitle(title: string): Promise<string[]> {
  const apiConfig = checkGoogleApiConfig();
  if (!apiConfig.naturalLanguage) {
    return [];
  }

  try {
    // タイトルから人名エンティティを抽出
    const names = await extractPerformerNames(title);

    // 日本語名のみをフィルタ
    return names.filter(name =>
      name.length >= 2 &&
      name.length <= 20 &&
      /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+$/.test(name)
    );
  } catch (error) {
    console.error('[normalize-performers] NLP extraction error:', error);
    return [];
  }
}

/**
 * 素人系AV女優まとめ で品番検索
 */
async function searchShiroutoMatome(productCode: string): Promise<string[]> {
  try {
    // Google Custom Search的なアプローチで複数サイトを検索
    const searchUrl = `https://shiroutomatome.com/?s=${encodeURIComponent(productCode)}`;

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
    const productCodeNorm = productCode.toUpperCase().replace(/-/g, '');

    // 記事タイトルから出演者名を抽出（「【出演者名】品番」形式が多い）
    $('h2 a, .entry-title a, article a').each((_, el) => {
      const title = $(el).text();
      const titleNorm = title.toUpperCase().replace(/-/g, '');

      if (titleNorm.includes(productCodeNorm)) {
        // 【】内の名前を抽出
        const bracketMatch = title.match(/【([^】]+)】/);
        if (bracketMatch) {
          const names = bracketMatch[1].split(/[,、]/).map(n => n.trim());
          for (const name of names) {
            if (name.length > 1 &&
                name.length < 30 &&
                /^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(name)) {
              performers.push(name);
            }
          }
        }

        // タイトル先頭の名前パターン（「名前 品番」形式）
        const nameMatch = title.match(/^([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,10})\s/);
        if (nameMatch) {
          performers.push(nameMatch[1]);
        }
      }
    });

    return [...new Set(performers)];
  } catch {
    return [];
  }
}

/**
 * ルックアップテーブルから出演者情報を取得（超高速）
 */
async function fetchFromLookupTable(
  db: ReturnType<typeof getDb>,
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
 * 検索結果をルックアップテーブルに保存（次回以降の高速化）
 */
async function saveToLookupTable(
  db: ReturnType<typeof getDb>,
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
    // ルックアップ保存エラーは無視（メイン処理に影響させない）
    console.error(`[normalize-performers] Lookup save error for ${productCode}:`, error);
  }
}

/**
 * 複数ソースから出演者情報を取得
 * 検索順序:
 *   1. ルックアップDB（超高速）
 *   2. Google Custom Search API（Cloudflareブロック回避）
 *   3. みんなのAV → AV-Wiki → Seesaa Wiki → nakiny → AVソムリエ → 素人系まとめ
 * Web検索で見つかった場合は自動的にルックアップDBに保存（次回以降の高速化）
 */
async function fetchPerformersFromWiki(
  productCode: string,
  db?: ReturnType<typeof getDb>,
  title?: string
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

  // 1. まずルックアップテーブルを検索（超高速）
  if (db) {
    for (const variant of variants) {
      const lookupResult = await fetchFromLookupTable(db, variant);
      if (lookupResult) {
        return lookupResult;
      }
    }
  }

  // 2. Google Custom Search API で検索（Cloudflareブロック回避）
  for (const variant of variants) {
    const googlePerformers = await searchGoogleCustomSearch(variant);
    if (googlePerformers.length > 0) {
      if (db) {
        await saveToLookupTable(db, variant, googlePerformers, 'google-search');
      }
      return { performers: googlePerformers, source: 'google-search' };
    }
  }

  // 3. タイトルからNLPで人名抽出を試行
  if (title) {
    const nlpPerformers = await extractPerformersFromTitle(title);
    if (nlpPerformers.length > 0) {
      console.log(`[normalize-performers] NLP extracted: ${nlpPerformers.join(', ')}`);
      // NLP抽出は精度が不確定なのでルックアップには保存しない
      return { performers: nlpPerformers, source: 'nlp-title' };
    }
  }

  // 4. 従来のWeb検索（フォールバック）
  for (const variant of variants) {
    // みんなのAV を最優先（信頼性高）
    let performers = await searchMinnaNoAV(variant);
    if (performers.length > 0) {
      // ルックアップDBに保存（次回以降の高速化）
      if (db) {
        await saveToLookupTable(db, variant, performers, 'minnano-av');
      }
      return { performers, source: 'minnano-av' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

    // AV-Wiki
    performers = await searchAVWiki(variant);
    if (performers.length > 0) {
      if (db) {
        await saveToLookupTable(db, variant, performers, 'av-wiki');
      }
      return { performers, source: 'av-wiki' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

    // Seesaa Wiki
    performers = await searchSeesaaWiki(variant);
    if (performers.length > 0) {
      if (db) {
        await saveToLookupTable(db, variant, performers, 'seesaawiki');
      }
      return { performers, source: 'seesaawiki' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

    // nakiny（素人系に強い）
    performers = await searchNakiny(variant);
    if (performers.length > 0) {
      if (db) {
        await saveToLookupTable(db, variant, performers, 'nakiny');
      }
      return { performers, source: 'nakiny' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

    // AVソムリエ
    performers = await searchAVSommelier(variant);
    if (performers.length > 0) {
      if (db) {
        await saveToLookupTable(db, variant, performers, 'av-sommelier');
      }
      return { performers, source: 'av-sommelier' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

    // 素人系AV女優まとめ
    performers = await searchShiroutoMatome(variant);
    if (performers.length > 0) {
      if (db) {
        await saveToLookupTable(db, variant, performers, 'shirouto-matome');
      }
      return { performers, source: 'shirouto-matome' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  return null;
}

/**
 * 出演者をDBに登録・紐付け
 * バリデーション済みの名前のみを登録
 */
async function linkPerformerToProduct(
  db: ReturnType<typeof getDb>,
  productId: number,
  performerName: string
): Promise<boolean> {
  try {
    // バリデーションと正規化
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

export async function GET(request: NextRequest) {
  // 認証チェック
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const db = getDb();
  const startTime = Date.now();

  const stats: Stats = {
    totalProcessed: 0,
    wikiHits: 0,
    performersAdded: 0,
    errors: 0,
    skipped: 0,
  };

  try {
    // クエリパラメータ
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const aspFilter = url.searchParams.get('asp') || null;

    console.log(`[normalize-performers] Starting: asp=${aspFilter || 'all'}, limit=${limit}, offset=${offset}`);

    // 出演者情報がない商品を取得
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

      // 品番を抽出
      const variants = generateSearchVariants(product.normalized_product_id, product.original_product_id);

      if (variants.length === 0) {
        console.log(`[normalize-performers] Skip: ${product.normalized_product_id} - no variants`);
        stats.skipped++;
        continue;
      }

      console.log(`[normalize-performers] Processing: ${product.normalized_product_id} variants=${variants.join(',')}`);

      // ルックアップDB + Google API + Wiki検索
      let result: { performers: string[]; source: string } | null = null;
      for (const variant of variants) {
        result = await fetchPerformersFromWiki(variant, db, product.title);
        if (result) break;
      }

      if (!result || result.performers.length === 0) {
        console.log(`[normalize-performers] No wiki hit: ${product.normalized_product_id}`);
        continue;
      }

      console.log(`[normalize-performers] Hit (${result.source}): ${product.normalized_product_id} -> ${result.performers.join(', ')}`);
      stats.wikiHits++;

      // 出演者を紐付け（スペース区切りの複数名前も分割処理）
      for (const rawPerformerName of result.performers) {
        // スペース区切りも含めて分割（「横山夢 皆野みらい」→ [「横山夢」, 「皆野みらい」]）
        const splitNames = parsePerformerNames(rawPerformerName, /[、,\/・\n\t\s　]+/);

        if (splitNames.length === 0) {
          // parsePerformerNamesで全て除外された場合、元の名前でも試行
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

      // レート制限
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
}
