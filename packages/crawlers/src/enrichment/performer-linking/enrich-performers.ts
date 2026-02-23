/**
 * 商品IDから演者情報を補填するスクリプト
 *
 * 演者未紐付けの商品に対して、FANZA/MGS/SOKMILの商品詳細を取得し、
 * 演者情報を取得して紐付けを行う
 *
 * 使用方法:
 * DATABASE_URL="..." npx tsx packages/crawlers/src/enrichment/enrich-performers.ts [--limit 100] [--asp FANZA|MGS|SOKMIL]
 */

import { getDb } from '../../lib/db';
import { products, productSources, performers, productPerformers } from '../../lib/db/schema';
import { eq, and, sql, isNull, inArray } from 'drizzle-orm';
import {
  isValidPerformerName,
  normalizePerformerName,
  isValidPerformerForProduct,
} from '../../lib/performer-validation';
import type { SokmilApiClient } from '../../lib/providers/sokmil-client';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';

puppeteer.use(StealthPlugin());

const db = getDb();

// Lazy initialization for SOKMIL client
let sokmilClient: SokmilApiClient | null = null;
function getSokmilClientLazy(): SokmilApiClient {
  if (!sokmilClient) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSokmilClient } = require('../../lib/providers/sokmil-client');
    sokmilClient = getSokmilClient();
  }
  return sokmilClient!;
}

let browser: Browser | null = null;

const RATE_LIMIT_MS = 1000;
const JITTER_MS = 500;

async function rateLimit(ms: number = RATE_LIMIT_MS): Promise<void> {
  const jitter = Math.random() * JITTER_MS;
  await new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

async function initBrowser(): Promise<Browser> {
  if (browser) return browser;

  console.log('🌐 Puppeteerブラウザを起動中...');
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  console.log('✅ ブラウザ起動完了');
  return browser;
}

async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * FANZAの商品詳細ページから演者名を取得
 */
async function getPerformersFromFanza(cid: string): Promise<string[]> {
  const browserInstance = await initBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setCookie(
      { name: 'age_check_done', value: '1', domain: '.dmm.co.jp' },
      { name: 'cklg', value: 'ja', domain: '.dmm.co.jp' },
    );

    const url = `https://video.dmm.co.jp/av/content/?id=${cid}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // JSON-LDから演者を抽出
    const performers = await page.evaluate(() => {
      const names: string[] = [];

      // JSON-LD構造化データから
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data.actor && Array.isArray(data.actor)) {
            for (const actor of data.actor) {
              if (actor.name) names.push(actor.name);
            }
          }
        } catch {}
      }

      // フォールバック: HTMLリンクから
      if (names.length === 0) {
        const actressLinks = document.querySelectorAll('a[href*="/av/list/?actress="]');
        for (const link of actressLinks) {
          const name = link.textContent?.trim();
          if (name && name.length < 30 && !name.includes('一覧')) {
            names.push(name);
          }
        }
      }

      return names;
    });

    return [...new Set(performers)];
  } catch (error) {
    console.error(`    ❌ FANZA取得エラー (${cid}):`, error);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * MGSの商品詳細ページから演者名を取得
 */
async function getPerformersFromMgs(productId: string): Promise<string[]> {
  const browserInstance = await initBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    const url = `https://www.mgstage.com/product/product_detail/${productId}/`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 演者名を抽出
    const performers = await page.evaluate(() => {
      const names: string[] = [];

      // 出演者リンクから
      const actorLinks = document.querySelectorAll('a[href*="/ppv/search/"]');
      for (const link of actorLinks) {
        const href = link.getAttribute('href') || '';
        if (href.includes('search_word=') || href.includes('actor=')) {
          const name = link.textContent?.trim();
          if (name && name.length >= 2 && name.length < 30) {
            names.push(name);
          }
        }
      }

      // テーブルから出演者を探す
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        const th = row.querySelector('th');
        if (th?.textContent?.includes('出演')) {
          const td = row.querySelector('td');
          if (td) {
            const links = td.querySelectorAll('a');
            for (const link of links) {
              const name = link.textContent?.trim();
              if (name && name.length >= 2 && name.length < 30) {
                names.push(name);
              }
            }
          }
        }
      }

      return names;
    });

    return [...new Set(performers)];
  } catch (error) {
    console.error(`    ❌ MGS取得エラー (${productId}):`, error);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * SOKMILのAPIから演者名を取得
 */
async function getPerformersFromSokmil(itemId: string): Promise<string[]> {
  try {
    const product = await getSokmilClientLazy().getItemById(itemId);
    if (product && product.actors && product.actors.length > 0) {
      return product.actors.map((a: { name: string }) => a.name);
    }
    return [];
  } catch (error) {
    console.error(`    ❌ SOKMIL取得エラー (${itemId}):`, error);
    return [];
  }
}

/**
 * 演者を商品に紐付け
 */
async function linkPerformersToProduct(productId: number, performerNames: string[]): Promise<number> {
  let linkedCount = 0;

  for (const name of performerNames) {
    if (!isValidPerformerName(name)) continue;

    const normalizedName = normalizePerformerName(name);
    if (!normalizedName) continue;

    // 既存の演者を検索
    let [performer] = await db.select().from(performers).where(eq(performers['name'], normalizedName)).limit(1);

    // 存在しなければ作成
    if (!performer) {
      const [inserted] = await db.insert(performers).values({ name: normalizedName }).returning();
      performer = inserted!;
    }

    // リンクが存在するかチェック
    const existingLink = await db
      .select()
      .from(productPerformers)
      .where(and(eq(productPerformers.productId, productId), eq(productPerformers.performerId, performer.id)))
      .limit(1);

    if (existingLink.length === 0) {
      await db['insert'](productPerformers).values({
        productId,
        performerId: performer.id,
      });
      linkedCount++;
    }
  }

  return linkedCount;
}

async function main() {
  const args = process.argv.slice(2);

  let limit = 100;
  let aspFilter: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg?.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1] ?? '100', 10);
    } else if (arg === '--limit' && nextArg) {
      limit = parseInt(nextArg, 10);
      i++;
    } else if (arg?.startsWith('--asp=')) {
      aspFilter = (arg.split('=')[1] ?? '').toUpperCase();
    } else if (arg === '--asp' && nextArg) {
      aspFilter = nextArg.toUpperCase();
      i++;
    }
  }

  console.log('=== 商品IDから演者情報を補填 ===');
  console.log(`処理上限: ${limit}件`);
  console.log(`ASPフィルタ: ${aspFilter || '全て'}\n`);

  // 対応ASP
  const supportedAsps = ['FANZA', 'MGS', 'SOKMIL'];

  // 演者未紐付けの商品を取得
  console.log('🔍 演者未紐付け商品を取得中...');

  // まず紐付け済み商品IDを取得
  const linkedIds = await db.selectDistinct({ productId: productPerformers.productId }).from(productPerformers);
  const linkedIdSet = new Set(linkedIds.map((r) => r.productId));
  console.log(`  紐付け済み商品: ${linkedIdSet.size}件`);

  // 商品を取得（対象ASPでフィルタ）
  const targetAsps = aspFilter ? [aspFilter] : supportedAsps;
  const allProducts = await db
    .select({
      productId: products['id'],
      title: products['title'],
      aspName: productSources.aspName,
      originalProductId: productSources.originalProductId,
    })
    .from(products)
    .innerJoin(productSources, eq(products['id'], productSources.productId))
    .where(inArray(productSources.aspName, targetAsps))
    .limit(limit * 5);

  // 未紐付け商品をフィルタ
  let filteredProducts = allProducts.filter((p) => !linkedIdSet.has(p.productId));

  // limitを適用
  filteredProducts = filteredProducts.slice(0, limit);

  console.log(`  ✓ ${filteredProducts.length}件の未紐付け商品を取得\n`);

  let totalLinked = 0;
  let totalProcessed = 0;
  let noPerformerCount = 0;

  for (let i = 0; i < filteredProducts.length; i++) {
    const product = filteredProducts[i];
    if (!product) continue;
    totalProcessed++;

    if (i % 10 === 0) {
      console.log(`[${i + 1}/${filteredProducts.length}] ${product.aspName}: ${product.originalProductId}`);
    }

    let performerNames: string[] = [];

    if (product.aspName === 'FANZA') {
      await rateLimit(3000); // FANZA用の長めのレート制限
      performerNames = await getPerformersFromFanza(product.originalProductId);
    } else if (product.aspName === 'MGS') {
      await rateLimit(3000); // MGS用の長めのレート制限
      performerNames = await getPerformersFromMgs(product.originalProductId);
    } else if (product.aspName === 'SOKMIL') {
      await rateLimit(1000); // SOKMIL APIは早め
      performerNames = await getPerformersFromSokmil(product.originalProductId);
    } else {
      continue;
    }

    if (performerNames.length > 0) {
      const linked = await linkPerformersToProduct(product.productId, performerNames);
      totalLinked += linked;
      if (i % 10 === 0) {
        console.log(`  👤 演者: ${performerNames.join(', ')} (${linked}件紐付け)`);
      }
    } else {
      noPerformerCount++;
    }
  }

  await closeBrowser();

  console.log('\n=== 完了 ===');
  console.log(`処理商品数: ${totalProcessed}件`);
  console.log(`新規紐付け: ${totalLinked}件`);
  console.log(`演者情報なし: ${noPerformerCount}件`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  closeBrowser().finally(() => process.exit(1));
});
