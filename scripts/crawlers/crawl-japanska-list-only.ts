/**
 * Japanska 一覧ページ専用クローラー (puppeteer-extra + stealth)
 *
 * 詳細ページにはアクセスせず、一覧ページから直接情報を抽出
 * ボット検知対策のため、ページ遷移を最小化
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getDb } from '../../lib/db';
import { products, productSources, performers, productPerformers } from '../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// Stealthプラグインを適用
puppeteer.use(StealthPlugin());

const db = getDb();

const BASE_URL = 'https://www.japanska-xxx.com';
const AFFILIATE_ID = 'a8_4bIZHPZmC3G6qZnOdxZNjx3ljlZhKxbj';

interface ProductInfo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  performers: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

/**
 * 一覧ページから商品情報を直接抽出
 */
async function extractProductsFromPage(page: any): Promise<ProductInfo[]> {
  return await page.evaluate(() => {
    const products: { id: string; title: string; thumbnailUrl: string | null; performers: string[] }[] = [];

    // movie_list内のすべてのリンクを取得
    const allLinks = document.querySelectorAll('a[href*="detail_"]');

    const processedIds = new Set<string>();

    allLinks.forEach(link => {
      const href = (link as HTMLAnchorElement).href;
      const idMatch = href.match(/detail_(\d+)\.html/);
      if (!idMatch) return;

      const id = idMatch[1];
      if (processedIds.has(id)) return;
      processedIds.add(id);

      // リンクの親要素から情報を探す
      let parent = link.parentElement;
      let title = '';
      let thumbnailUrl: string | null = null;
      const performers: string[] = [];

      // 親要素を5段階まで遡って情報を探す
      for (let i = 0; i < 5 && parent; i++) {
        // タイトルを探す
        if (!title) {
          const titleEl = parent.querySelector('.movie_title, .title, h3, h4');
          if (titleEl) {
            title = titleEl.textContent?.trim() || '';
          }
        }

        // リンク自体のテキストがタイトルかもしれない
        if (!title) {
          const linkText = link.textContent?.trim();
          if (linkText && linkText.length > 5) {
            title = linkText;
          }
        }

        // サムネイルを探す
        if (!thumbnailUrl) {
          const img = parent.querySelector('img');
          if (img) {
            thumbnailUrl = img.src || img.getAttribute('data-src') || null;
          }
        }

        // 出演者を探す
        const actorLinks = parent.querySelectorAll('a[href*="actress_"]');
        actorLinks.forEach(el => {
          const name = el.textContent?.trim();
          if (name && !performers.includes(name)) {
            performers.push(name);
          }
        });

        parent = parent.parentElement;
      }

      // リンク内のimgも確認
      if (!thumbnailUrl) {
        const img = link.querySelector('img');
        if (img) {
          thumbnailUrl = img.src || img.getAttribute('data-src') || null;
        }
      }

      // 少なくともIDは必須
      if (id) {
        products.push({
          id,
          title: title || `Japanska-${id}`,
          thumbnailUrl,
          performers
        });
      }
    });

    return products;
  });
}

/**
 * 商品をDBに保存
 */
async function saveProduct(info: ProductInfo): Promise<{ productId: number | null; isNew: boolean }> {
  try {
    const normalizedProductId = `japanska-${info.id}`;

    // 既存チェック
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productId: number;
    let isNew = false;

    if (existing.length > 0) {
      productId = existing[0].id;
      // 既存でタイトルがプレースホルダーの場合のみ更新
      if (
        (existing[0].title?.startsWith('Japanska作品') || existing[0].title?.startsWith('Japanska-')) &&
        info.title && !info.title.startsWith('Japanska-')
      ) {
        await db.update(products).set({
          title: info.title,
          defaultThumbnailUrl: info.thumbnailUrl || undefined,
          updatedAt: new Date(),
        }).where(eq(products.id, productId));
        console.log(`    ⏫ 既存商品を更新 (ID: ${productId})`);
      }
    } else {
      // 新規商品作成
      const [inserted] = await db.insert(products).values({
        normalizedProductId,
        title: info.title,
        description: '',
        defaultThumbnailUrl: info.thumbnailUrl || undefined,
      }).returning({ id: products.id });

      productId = inserted.id;
      isNew = true;
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

    return { productId, isNew };
  } catch (error) {
    console.error(`    ❌ 保存エラー: ${error}`);
    return { productId: null, isNew: false };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const startPageArg = args.find(arg => arg.startsWith('--start-page='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 500;
  const startPage = startPageArg ? parseInt(startPageArg.split('=')[1]) : 1;

  console.log('=== Japanska 一覧ページ専用クローラー ===\n');
  console.log(`設定: limit=${limit}, startPage=${startPage}\n`);

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
  let processedCount = 0;
  let pageNum = startPage;
  const maxPages = 2000;
  const processedIds = new Set<string>();

  console.log('一覧ページから商品を取得します（詳細ページへの遷移なし）...\n');

  // カテゴリ別の一覧ページを巡回
  const categories = [
    { name: '全作品', url: '/category/list_0.html' },
    { name: '新着', url: '/movie/list.html' },
  ];

  for (const category of categories) {
    pageNum = startPage;
    console.log(`\n📁 カテゴリ: ${category.name}`);

    while (pageNum <= maxPages && (newCount + updatedCount) < limit) {
      const url = pageNum === 1 ? `${BASE_URL}${category.url}` : `${BASE_URL}${category.url}?page=${pageNum}`;
      console.log(`\n📄 ページ ${pageNum}: ${url}`);

      try {
        await randomDelay(1500, 3000);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch (error) {
        console.log(`  ✗ ページ読み込みエラー: ${error}`);
        pageNum++;
        continue;
      }

      // 一覧ページから情報を抽出
      const productsOnPage = await extractProductsFromPage(page);
      console.log(`  ${productsOnPage.length}件の商品を発見`);

      if (productsOnPage.length === 0) {
        console.log('  終端到達');
        break;
      }

      // 未処理の商品を処理
      let newOnThisPage = 0;
      for (const product of productsOnPage) {
        if ((newCount + updatedCount) >= limit) break;
        if (processedIds.has(product.id)) continue;

        processedIds.add(product.id);
        processedCount++;

        const result = await saveProduct(product);
        if (result.productId) {
          if (result.isNew) {
            newCount++;
            newOnThisPage++;
          } else {
            updatedCount++;
          }
        }
      }

      console.log(`  処理: ${productsOnPage.length}件, 新規: ${newOnThisPage}件`);

      pageNum++;
      await randomDelay(2000, 4000);
    }
  }

  await browser.close();

  console.log('\n=== 最終結果 ===');
  console.log(`処理数: ${processedCount}件`);
  console.log(`新規: ${newCount}件`);
  console.log(`更新: ${updatedCount}件`);

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
