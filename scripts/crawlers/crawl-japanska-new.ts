/**
 * Japanska 新規商品取得クローラー (Puppeteer)
 * 一覧ページから新しい商品を取得してDBに保存
 */

import puppeteer from 'puppeteer';
import { getDb } from '../../lib/db';
import { products, productSources, performers, productPerformers, rawHtmlData } from '../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

const db = getDb();

const BASE_URL = 'https://www.japanska-xxx.com';
const LIST_URL = `${BASE_URL}/category/list_0.html`;
const AFFILIATE_ID = 'a8_4bIZHPZmC3G6qZnOdxZNjx3ljlZhKxbj';
const DELAY_MS = 2000;

interface ProductInfo {
  id: string;
  title: string;
  performers: string[];
  thumbnailUrl: string | null;
  description?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 一覧ページからIDリストを取得
 */
async function getIdsFromListPage(page: puppeteer.Page): Promise<string[]> {
  const ids = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="movie/detail_"]');
    const idSet = new Set<string>();
    links.forEach(link => {
      const href = (link as HTMLAnchorElement).href;
      const match = href.match(/detail_(\d+)\.html/);
      if (match) {
        idSet.add(match[1]);
      }
    });
    return Array.from(idSet);
  });
  return ids;
}

/**
 * 詳細リンクをクリックして情報取得、その後戻る
 */
async function clickAndFetchDetail(
  page: puppeteer.Page,
  id: string
): Promise<ProductInfo | null> {
  try {
    // リンクをクリック
    const linkSelector = `a[href*="detail_${id}.html"]`;
    const linkExists = await page.$(linkSelector);
    if (!linkExists) {
      return null;
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click(linkSelector),
    ]);

    // ホームページへのリダイレクトを検出
    const pageContent = await page.content();
    if (
      pageContent.includes('<!--home.html-->') ||
      (pageContent.includes('幅広いジャンル') && pageContent.includes('30日'))
    ) {
      await page.goBack({ waitUntil: 'networkidle2' });
      return null;
    }

    // 生HTMLを保存
    const hash = createHash('sha256').update(pageContent).digest('hex');
    await db.insert(rawHtmlData).values({
      source: 'Japanska',
      productId: id,
      url: page.url(),
      htmlContent: pageContent,
      hash,
    }).onConflictDoUpdate({
      target: [rawHtmlData.source, rawHtmlData.productId],
      set: {
        htmlContent: pageContent,
        hash,
        crawledAt: new Date(),
      },
    });

    // タイトル抽出
    const title = await page.evaluate(() => {
      const movieTtl = document.querySelector('.movie_ttl p');
      if (movieTtl && movieTtl.textContent) {
        return movieTtl.textContent.trim();
      }
      const h1 = document.querySelector('h1');
      if (h1 && h1.textContent) {
        return h1.textContent.trim();
      }
      return null;
    });

    if (!title) {
      await page.goBack({ waitUntil: 'networkidle2' });
      return null;
    }

    // 出演者抽出
    const performerNames = await page.evaluate(() => {
      const names: string[] = [];
      const links = document.querySelectorAll('a[href*="actress_"]');
      links.forEach(link => {
        const name = link.textContent?.trim();
        if (name && !names.includes(name)) {
          names.push(name);
        }
      });
      return names;
    });

    // サムネイル抽出
    const thumbnailUrl = await page.evaluate(() => {
      const img = document.querySelector('.movie_image') as HTMLImageElement;
      return img?.src || null;
    });

    // 説明文抽出
    const description = await page.evaluate(() => {
      const desc = document.querySelector('.movie_desc, .description');
      return desc?.textContent?.trim() || undefined;
    });

    // 一覧に戻る
    await page.goBack({ waitUntil: 'networkidle2' });

    return { id, title, performers: performerNames, thumbnailUrl, description };
  } catch (error) {
    console.log(`  ✗ エラー: ${error}`);
    try {
      await page.goBack({ waitUntil: 'networkidle2' });
    } catch {}
    return null;
  }
}

/**
 * 商品をDBに保存
 */
async function saveProduct(info: ProductInfo): Promise<number | null> {
  try {
    const normalizedProductId = `japanska-${info.id}`;

    // 既存チェック
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productId: number;

    if (existing.length > 0) {
      productId = existing[0].id;
      // 既存商品の更新
      await db.update(products).set({
        title: info.title,
        defaultThumbnailUrl: info.thumbnailUrl || undefined,
        description: info.description || '',
        updatedAt: new Date(),
      }).where(eq(products.id, productId));
      console.log(`    ⏭️ 既存商品を更新 (ID: ${productId})`);
    } else {
      // 新規商品作成
      const [inserted] = await db.insert(products).values({
        normalizedProductId,
        title: info.title,
        description: info.description || '',
        defaultThumbnailUrl: info.thumbnailUrl || undefined,
      }).returning({ id: products.id });

      productId = inserted.id;
      console.log(`    ✓ 新規商品作成 (ID: ${productId})`);

      // product_sources作成
      const affiliateUrl = `${BASE_URL}/movie/detail_${info.id}.html?aff=${AFFILIATE_ID}`;
      await db.insert(productSources).values({
        productId,
        aspName: 'Japanska',
        originalProductId: info.id,
        affiliateUrl,
        dataSource: 'CRAWL',
      });
    }

    // 出演者登録
    for (const performerName of info.performers) {
      // 演者を検索または作成
      const [existingPerformer] = await db
        .select()
        .from(performers)
        .where(eq(performers.name, performerName))
        .limit(1);

      let performerId: number;
      if (existingPerformer) {
        performerId = existingPerformer.id;
      } else {
        const [inserted] = await db
          .insert(performers)
          .values({ name: performerName })
          .returning({ id: performers.id });
        performerId = inserted.id;
      }

      // 商品-出演者リンク
      await db.insert(productPerformers).values({
        productId,
        performerId,
      }).onConflictDoNothing();
    }

    return productId;
  } catch (error) {
    console.error(`    ❌ 保存エラー: ${error}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const startPageArg = args.find(arg => arg.startsWith('--start-page='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const startPage = startPageArg ? parseInt(startPageArg.split('=')[1]) : 1;

  console.log('=== Japanska 新規商品取得クローラー ===\n');
  console.log(`設定: limit=${limit}, startPage=${startPage}\n`);

  // Puppeteerを起動
  console.log('ブラウザを起動中...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();

  // ユーザーエージェントを設定
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // ビューポートを設定
  await page.setViewport({ width: 1920, height: 1080 });

  // 言語設定
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  });

  let newCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let pageNum = startPage;
  const maxPages = 500;
  const processedIds = new Set<string>();

  console.log('一覧ページから商品を取得します...\n');

  // 一覧ページを巡回
  while (pageNum <= maxPages && (newCount + updatedCount) < limit) {
    const url = pageNum === 1 ? LIST_URL : `${LIST_URL}?page=${pageNum}`;
    console.log(`📄 一覧ページ ${pageNum}: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (error) {
      console.log(`  ✗ ページ読み込みエラー: ${error}`);
      pageNum++;
      continue;
    }

    // このページのIDを取得
    const idsOnPage = await getIdsFromListPage(page);
    console.log(`  ${idsOnPage.length}件のIDを発見`);

    if (idsOnPage.length === 0) {
      console.log('  終端到達');
      break;
    }

    // 未処理のIDを抽出
    const newIds = idsOnPage.filter(id => !processedIds.has(id));
    console.log(`  未処理: ${newIds.length}件`);

    // 各IDを処理
    for (const id of newIds) {
      if ((newCount + updatedCount) >= limit) break;

      console.log(`  [${newCount + updatedCount + 1}/${limit}] ID: ${id}`);

      const info = await clickAndFetchDetail(page, id);

      if (info && info.title) {
        console.log(`    タイトル: ${info.title.substring(0, 50)}...`);
        if (info.performers.length > 0) {
          console.log(`    出演者: ${info.performers.join(', ')}`);
        }

        const savedId = await saveProduct(info);
        if (savedId) {
          // 既存かどうかチェック
          const existing = await db.execute(sql`
            SELECT id FROM product_sources
            WHERE asp_name = 'Japanska' AND original_product_id = ${id}
            AND created_at < NOW() - INTERVAL '1 minute'
          `);
          if (existing.rows.length > 0) {
            updatedCount++;
          } else {
            newCount++;
          }
        } else {
          failedCount++;
        }
      } else {
        console.log(`    ✗ 取得失敗`);
        failedCount++;
      }

      processedIds.add(id);
      await sleep(DELAY_MS);
    }

    pageNum++;
    await sleep(1000);
  }

  await browser.close();

  console.log('\n=== 最終結果 ===');
  console.log(`新規: ${newCount}件`);
  console.log(`更新: ${updatedCount}件`);
  console.log(`失敗: ${failedCount}件`);

  // 最終統計
  const stats = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'Japanska'
  `);
  console.log(`\nJapanska総商品数: ${stats.rows[0].count}`);

  process.exit(0);
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
