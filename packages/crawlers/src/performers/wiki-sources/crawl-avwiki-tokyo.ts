/**
 * av-wiki.tokyo から女優の別名・作品紐付け情報をクロールするスクリプト
 * puppeteer-extra + stealth プラグインを使用
 *
 * 取得対象:
 * - 別名（旧芸名、他名義）
 * - 品番から作品紐付け
 */

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db';
import { performers, performerAliases, products, productPerformers } from '../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { StealthCrawler } from '../../lib/stealth-browser';

const BASE_URL = 'https://av-wiki.tokyo';

interface ActressData {
  name: string;
  aliases: string[];
  productIds: string[]; // 品番のみ
}

// グローバルクローラーインスタンス
let crawler: StealthCrawler | null = null;

/**
 * 女優個別ページから別名・品番を取得
 */
async function fetchActressPage(actressName: string): Promise<ActressData | null> {
  const encodedName = encodeURIComponent(actressName);
  const url = `${BASE_URL}/wiki/${encodedName}`;

  console.log(`  Fetching: ${url}`);

  try {
    if (!crawler) {
      crawler = new StealthCrawler({ timeout: 30000 });
      await crawler.init();
    }

    const result = await crawler.fetch(url);

    if (result['status'] === 404 || result.html.includes('このページは存在しません')) {
      console.log(`  Not found: ${actressName}`);
      return null;
    }

    if (result['status'] !== 200) {
      console.error(`  HTTP ${result['status']}: ${url}`);
      return null;
    }

    const $ = cheerio.load(result.html);

    const data: ActressData = {
      name: actressName,
      aliases: [],
      productIds: [],
    };

    // infobox テーブルから別名を抽出
    $('table.infobox tr, table.wikitable tr, .mw-parser-output table tr').each((_, row) => {
      const $row = $(row);
      const header = $row.find('th').text().trim().toLowerCase();
      const value = $row.find('td').text().trim();

      if (!header || !value) return;

      // 別名
      if (
        header.includes('別名') ||
        header.includes('旧芸名') ||
        header.includes('他名義') ||
        header.includes('別名義')
      ) {
        const aliases = value
          .split(/[,、/／\n]/)
          .map((a) => a.trim())
          .filter((a) => a.length > 0 && a !== actressName);
        data.aliases.push(...aliases);
      }
    });

    // 作品リストから品番を抽出（品番形式: ABC-123）
    const productPattern = /([A-Z]{2,10}-?\d{2,5})/gi;
    const foundProducts = new Set<string>();

    // リンクから品番を抽出
    $('a[href*="/wiki/"]').each((_, link) => {
      const text = $(link).text().trim();
      const matches = text.match(productPattern);
      if (matches) {
        matches.forEach((m) => foundProducts.add(m.toUpperCase()));
      }
    });

    // テーブルから品番を抽出
    $('table tr td').each((_, cell) => {
      const text = $(cell).text().trim();
      const matches = text.match(productPattern);
      if (matches) {
        matches.forEach((m) => foundProducts.add(m.toUpperCase()));
      }
    });

    data.productIds = Array.from(foundProducts);

    console.log(`  Found: ${data.aliases.length} alias(es), ${data.productIds.length} product(s)`);

    return data;
  } catch (error) {
    console.error(`  Error fetching ${actressName}:`, error);
    return null;
  }
}

/**
 * データベースに保存
 */
async function saveActressData(
  db: any,
  performerId: number,
  data: ActressData,
): Promise<{ aliases: number; products: number }> {
  const result = { aliases: 0, products: 0 };

  // 別名を保存
  for (const alias of data.aliases) {
    if (!alias || alias === data['name']) continue;
    try {
      await db['insert'](performerAliases)
        .values({
          performerId,
          aliasName: alias,
          source: 'av-wiki.tokyo',
          isPrimary: false,
        })
        .onConflictDoNothing();
      result.aliases++;
    } catch {
      // 重複は無視
    }
  }

  // 商品紐付け
  for (const productId of data.productIds) {
    try {
      const normalizedCode = productId.toLowerCase().replace(/[^a-z0-9]/g, '-');

      // 商品を検索
      const existingProduct = await db['select']()
        .from(products)
        .where(eq(products.normalizedProductId, normalizedCode))
        .limit(1);

      if (existingProduct.length > 0) {
        await db['insert'](productPerformers)
          .values({
            productId: existingProduct[0]['id'],
            performerId,
          })
          .onConflictDoNothing();
        result.products++;
      }
    } catch {
      // 重複は無視
    }
  }

  return result;
}

/**
 * メイン処理
 */
async function main() {
  const db = getDb();
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limitArg = limitIdx !== -1 ? args[limitIdx + 1] : undefined;
  const limit = limitArg ? parseInt(limitArg, 10) : 100;

  console.log('=== av-wiki.tokyo Crawler (別名・作品紐付け) ===\n');
  console.log(`Limit: ${limit} actresses\n`);

  // 作品紐付けが少ない女優を優先的に処理
  const actressesToProcess = await db.execute(sql`
    SELECT p.id, p.name
    FROM performers p
    LEFT JOIN performer_aliases pa ON p.id = pa.performer_id AND pa.source = 'av-wiki.tokyo'
    WHERE pa.id IS NULL
    ORDER BY (
      SELECT COUNT(*) FROM product_performers pp WHERE pp.performer_id = p.id
    ) DESC
    LIMIT ${limit}
  `);

  console.log(`Found ${actressesToProcess.rows.length} actresses to process\n`);

  interface ActressRow {
    id: number;
    name: string;
  }

  let successCount = 0;
  let failCount = 0;
  let totalAliases = 0;
  let totalProducts = 0;

  for (const actress of actressesToProcess.rows as unknown as ActressRow[]) {
    console.log(`\n[${successCount + failCount + 1}/${actressesToProcess.rows.length}] Processing: ${actress['name']}`);

    const data = await fetchActressPage(actress['name']);

    if (data) {
      const result = await saveActressData(db, actress['id'], data);
      totalAliases += result.aliases;
      totalProducts += result.products;

      if (result.aliases > 0 || result.products > 0) {
        console.log(`  Saved: ${result.aliases} alias(es), ${result.products} product(s)`);
      }
      successCount++;
    } else {
      failCount++;
    }

    // Rate limiting: 2秒待機
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // クローラーをクリーンアップ
  if (crawler) {
    await crawler.close();
  }

  console.log('\n=== Summary ===');
  console.log(`Processed: ${successCount + failCount}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Aliases added: ${totalAliases}`);
  console.log(`Products linked: ${totalProducts}`);

  process.exit(0);
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  if (crawler) {
    await crawler.close();
  }
  process.exit(1);
});
