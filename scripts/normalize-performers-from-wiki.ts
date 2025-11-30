/**
 * 品番ベースのWiki名寄せスクリプト
 *
 * 出演者情報がない商品の品番をWikiで検索し、出演者情報を取得・紐付け
 *
 * Run with: npx tsx scripts/normalize-performers-from-wiki.ts [limit] [asp]
 * Example:  npx tsx scripts/normalize-performers-from-wiki.ts 100 DTI
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

interface WikiPerformerResult {
  productId: string;
  performers: string[];
  source: 'av-wiki' | 'seesaawiki' | 'msin';
}

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

    // 検索結果から出演者名を抽出
    // パターン1: 女優名がリンクになっている
    $('a[href*="/av-actress/"]').each((_, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 1 && name.length < 30) {
        performers.push(name);
      }
    });

    // パターン2: 出演者欄のテキスト
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

    // 検索結果のタイトルから女優名を抽出
    $('.search-result a').each((_, el) => {
      const title = $(el).text().trim();
      // タイトルが女優名の可能性が高い（ひらがな/カタカナ/漢字のみ）
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
 * みんなのAV で品番検索
 * 検索結果から作品詳細ページに移動し、正確な出演者を取得
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
    // 品番が一致する作品を優先
    let movieUrl: string | null = null;
    const productCodeNorm = productCode.toUpperCase().replace(/-/g, '');

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim().toUpperCase().replace(/-/g, '');

      // 作品ページへのリンクで品番が含まれている
      if (href.includes('.html') && !href.includes('actress') && !href.includes('maker')) {
        if (text.includes(productCodeNorm) || href.toUpperCase().includes(productCodeNorm)) {
          movieUrl = href.startsWith('http') ? href : `https://www.minnano-av.com/${href}`;
          return false; // ループ終了
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

    // 詳細ページの女優リンクを抽出
    $detail('a[href*="actress"]').each((_, el) => {
      const name = $detail(el).text().trim();
      // 有効な女優名かチェック
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
 * 複数ソースから出演者情報を取得
 */
async function fetchPerformersFromWiki(productCode: string): Promise<WikiPerformerResult | null> {
  const variants = [productCode];

  // ハイフンあり・なしのバリエーション
  if (productCode.includes('-')) {
    variants.push(productCode.replace(/-/g, ''));
  } else {
    // ABC123 → ABC-123 形式に変換
    const match = productCode.match(/^([A-Z]+)(\d+)$/i);
    if (match) {
      variants.push(`${match[1]}-${match[2]}`);
    }
  }

  for (const variant of variants) {
    // みんなのAV を最優先（最も信頼性が高い）
    let performers = await searchMinnaNoAV(variant);
    if (performers.length > 0) {
      return { productId: productCode, performers, source: 'msin' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

    // AV-Wiki
    performers = await searchAVWiki(variant);
    if (performers.length > 0) {
      return { productId: productCode, performers, source: 'av-wiki' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

    // Seesaa Wiki
    performers = await searchSeesaaWiki(variant);
    if (performers.length > 0) {
      return { productId: productCode, performers, source: 'seesaawiki' };
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  return null;
}

/**
 * 出演者をDBに登録・紐付け
 */
async function linkPerformerToProduct(
  db: ReturnType<typeof getDb>,
  productId: number,
  performerName: string
): Promise<boolean> {
  try {
    // 出演者を取得または作成
    const performerResult = await db.execute(sql`
      INSERT INTO performers (name)
      VALUES (${performerName})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);

    const performerId = (performerResult.rows[0] as { id: number }).id;

    // 商品と紐付け
    await db.execute(sql`
      INSERT INTO product_performers (product_id, performer_id)
      VALUES (${productId}, ${performerId})
      ON CONFLICT DO NOTHING
    `);

    return true;
  } catch (error) {
    console.error(`  Error linking performer ${performerName}:`, error);
    return false;
  }
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 100;
  const aspFilter = args[1] || null; // DTI, DUGA, b10f など

  console.log('===========================================');
  console.log('品番ベース Wiki 名寄せスクリプト');
  console.log('===========================================');
  console.log(`処理上限: ${limit}`);
  console.log(`ASPフィルタ: ${aspFilter || '全て'}`);
  console.log('');

  const db = getDb();
  const stats: Stats = {
    totalProcessed: 0,
    wikiHits: 0,
    performersAdded: 0,
    errors: 0,
    skipped: 0,
  };

  try {
    // 出演者情報がない商品を取得（original_product_idも取得）
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
      `);
    }

    const products = productsResult.rows as Array<{
      id: number;
      normalized_product_id: string;
      title: string;
      asp_name: string;
      original_product_id: string;
    }>;

    console.log(`処理対象: ${products.length}件`);
    console.log('');

    for (const product of products) {
      stats.totalProcessed++;

      // 品番を抽出（original_product_idを優先）
      const variants = generateSearchVariants(product.normalized_product_id, product.original_product_id);

      if (variants.length === 0) {
        console.log(`[${stats.totalProcessed}/${products.length}] ${product.normalized_product_id} - 品番抽出失敗、スキップ`);
        stats.skipped++;
        continue;
      }

      console.log(`[${stats.totalProcessed}/${products.length}] ${product.normalized_product_id} (${product.asp_name})`);
      console.log(`  品番候補: ${variants.join(', ')}`);

      // Wiki検索
      let result: WikiPerformerResult | null = null;
      for (const variant of variants) {
        result = await fetchPerformersFromWiki(variant);
        if (result) break;
      }

      if (!result || result.performers.length === 0) {
        console.log(`  → Wiki該当なし`);
        continue;
      }

      console.log(`  → ${result.source}でヒット: ${result.performers.join(', ')}`);
      stats.wikiHits++;

      // 出演者を紐付け
      for (const performerName of result.performers) {
        const success = await linkPerformerToProduct(db, product.id, performerName);
        if (success) {
          stats.performersAdded++;
        }
      }

      // レート制限
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }

    // 結果サマリー
    console.log('');
    console.log('===========================================');
    console.log('処理完了');
    console.log('===========================================');
    console.log(`処理件数: ${stats.totalProcessed}`);
    console.log(`Wikiヒット: ${stats.wikiHits} (${((stats.wikiHits / stats.totalProcessed) * 100).toFixed(1)}%)`);
    console.log(`出演者追加: ${stats.performersAdded}`);
    console.log(`スキップ: ${stats.skipped}`);
    console.log(`エラー: ${stats.errors}`);

  } catch (error) {
    console.error('エラー発生:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
