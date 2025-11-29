/**
 * Japanska ステルスクローラー (puppeteer-extra + stealth)
 * ボット検知対策を強化した新規商品取得クローラー
 *
 * 一覧ページから情報を直接抽出（詳細ページへの遷移を最小化）
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getDb } from '../../lib/db';
import { products, productSources, performers, productPerformers, rawHtmlData } from '../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

// Stealthプラグインを適用
puppeteer.use(StealthPlugin());

const db = getDb();

const BASE_URL = 'https://www.japanska-xxx.com';
const LIST_URL = `${BASE_URL}/category/list_0.html`;
const AFFILIATE_ID = 'a8_4bIZHPZmC3G6qZnOdxZNjx3ljlZhKxbj';
const DELAY_MS = 3000; // 長めのディレイ

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

// ランダムな待機時間を追加
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

/**
 * 一覧ページから商品情報を直接抽出（詳細ページに行かない）
 */
async function extractProductsFromListPage(page: any): Promise<ProductInfo[]> {
  return await page.evaluate(() => {
    const products: ProductInfo[] = [];

    // 商品カードを取得
    const items = document.querySelectorAll('.movie_list li, .movie_item, .item');

    items.forEach(item => {
      // IDを抽出
      const link = item.querySelector('a[href*="detail_"]');
      if (!link) return;

      const href = (link as HTMLAnchorElement).href;
      const idMatch = href.match(/detail_(\d+)\.html/);
      if (!idMatch) return;

      const id = idMatch[1];

      // タイトルを抽出
      const titleEl = item.querySelector('.movie_title, .title, h3, h4, p');
      const title = titleEl?.textContent?.trim() || '';

      // サムネイルを抽出
      const img = item.querySelector('img');
      const thumbnailUrl = img?.src || img?.getAttribute('data-src') || null;

      // 出演者（一覧ページには通常ないが、念のため）
      const performerEls = item.querySelectorAll('a[href*="actress_"]');
      const performers: string[] = [];
      performerEls.forEach(el => {
        const name = el.textContent?.trim();
        if (name && !performers.includes(name)) {
          performers.push(name);
        }
      });

      if (id && title) {
        products.push({
          id,
          title,
          performers,
          thumbnailUrl
        });
      }
    });

    return products;
  });
}

/**
 * 詳細ページから情報を取得（慎重に）
 */
async function fetchDetailPage(page: any, id: string): Promise<ProductInfo | null> {
  try {
    const detailUrl = `${BASE_URL}/movie/detail_${id}.html`;

    // 人間らしい動きを模倣
    await randomDelay(2000, 4000);

    // Refererを設定
    await page.setExtraHTTPHeaders({
      'Referer': LIST_URL,
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    });

    await page.goto(detailUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // ホームへのリダイレクトを検出
    const currentUrl = page.url();
    if (currentUrl.includes('index.html') || currentUrl === BASE_URL || currentUrl === BASE_URL + '/') {
      console.log(`    ⚠️ ホームにリダイレクト`);
      return null;
    }

    const pageContent = await page.content();

    // ホームページのコンテンツチェック
    if (
      pageContent.includes('<!--home.html-->') ||
      (pageContent.includes('幅広いジャンル') && pageContent.includes('30日'))
    ) {
      console.log(`    ⚠️ ホームページ検出`);
      return null;
    }

    // 生HTMLを保存
    const hash = createHash('sha256').update(pageContent).digest('hex');
    await db.insert(rawHtmlData).values({
      source: 'Japanska',
      productId: id,
      url: detailUrl,
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
      const img = document.querySelector('.movie_image, .main_image img, .detail_image img') as HTMLImageElement;
      return img?.src || null;
    });

    // 説明文抽出
    const description = await page.evaluate(() => {
      const desc = document.querySelector('.movie_desc, .description, .detail_text');
      return desc?.textContent?.trim() || undefined;
    });

    return { id, title, performers: performerNames, thumbnailUrl, description };
  } catch (error) {
    console.log(`    ✗ 詳細取得エラー: ${error}`);
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
      // タイトルがプレースホルダーでない場合のみ更新
      if (info.title && !info.title.startsWith('Japanska作品') && !info.title.startsWith('Japanska-')) {
        await db.update(products).set({
          title: info.title,
          defaultThumbnailUrl: info.thumbnailUrl || undefined,
          description: info.description || '',
          updatedAt: new Date(),
        }).where(eq(products.id, productId));
        console.log(`    ⏫ 既存商品を更新 (ID: ${productId})`);
      }
    } else {
      // 新規商品作成
      const [inserted] = await db.insert(products).values({
        normalizedProductId,
        title: info.title,
        description: info.description || '',
        defaultThumbnailUrl: info.thumbnailUrl || undefined,
      }).returning({ id: products.id });

      productId = inserted.id;
      console.log(`    ✅ 新規商品作成 (ID: ${productId})`);

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
  const detailMode = args.includes('--detail'); // 詳細ページを取得するか

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const startPage = startPageArg ? parseInt(startPageArg.split('=')[1]) : 1;

  console.log('=== Japanska ステルスクローラー ===\n');
  console.log(`設定: limit=${limit}, startPage=${startPage}, detailMode=${detailMode}\n`);

  // Puppeteer (with stealth) を起動
  console.log('ブラウザを起動中 (stealth mode)...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
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
      await randomDelay(1000, 2000);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (error) {
      console.log(`  ✗ ページ読み込みエラー: ${error}`);
      pageNum++;
      continue;
    }

    // 一覧ページから情報を抽出
    const productsOnPage = await extractProductsFromListPage(page);
    console.log(`  ${productsOnPage.length}件の商品を発見`);

    if (productsOnPage.length === 0) {
      // 別のセレクタで試す
      const ids = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="detail_"]');
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

      if (ids.length === 0) {
        console.log('  終端到達または構造変更');
        break;
      }

      console.log(`  ${ids.length}件のIDを発見（一覧抽出失敗、詳細取得モード）`);

      // 詳細ページから取得
      for (const id of ids) {
        if ((newCount + updatedCount) >= limit) break;
        if (processedIds.has(id)) continue;

        console.log(`  [${newCount + updatedCount + 1}/${limit}] ID: ${id}`);

        const info = await fetchDetailPage(page, id);

        if (info && info.title) {
          console.log(`    タイトル: ${info.title.substring(0, 40)}...`);
          const savedId = await saveProduct(info);
          if (savedId) {
            newCount++;
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }

        processedIds.add(id);
        await randomDelay(DELAY_MS, DELAY_MS + 2000);
      }
    } else {
      // 一覧から取得できた場合
      for (const product of productsOnPage) {
        if ((newCount + updatedCount) >= limit) break;
        if (processedIds.has(product.id)) continue;

        console.log(`  [${newCount + updatedCount + 1}/${limit}] ID: ${product.id}`);
        console.log(`    タイトル: ${product.title.substring(0, 40)}...`);

        // 詳細モードの場合は詳細ページも取得
        if (detailMode) {
          const detailInfo = await fetchDetailPage(page, product.id);
          if (detailInfo) {
            Object.assign(product, detailInfo);
          }
        }

        const savedId = await saveProduct(product);
        if (savedId) {
          const existing = await db.execute(sql`
            SELECT id FROM product_sources
            WHERE asp_name = 'Japanska' AND original_product_id = ${product.id}
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

        processedIds.add(product.id);
        await randomDelay(500, 1000);
      }
    }

    pageNum++;
    await randomDelay(1500, 3000);
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
  console.log(`\nJapanska総商品数: ${(stats.rows[0] as any).count}`);

  process.exit(0);
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
