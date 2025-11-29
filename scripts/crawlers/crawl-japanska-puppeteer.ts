/**
 * Japanska Puppeteerクローラー
 * 一覧ページからリンクをクリックして詳細ページに遷移
 * (直接URLアクセスは不可)
 */

import puppeteer from 'puppeteer';
import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

const BASE_URL = 'https://www.japanska-xxx.com';
const LIST_URL = `${BASE_URL}/category/list_0.html`;
const DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface ProductInfo {
  id: string;
  title: string;
  performers: string[];
  thumbnailUrl: string | null;
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
    const performers = await page.evaluate(() => {
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

    // 一覧に戻る
    await page.goBack({ waitUntil: 'networkidle2' });

    return { id, title, performers, thumbnailUrl };
  } catch (error) {
    console.log(`  ✗ エラー: ${error}`);
    try {
      await page.goBack({ waitUntil: 'networkidle2' });
    } catch {}
    return null;
  }
}

/**
 * データベースの商品タイトルを更新
 */
async function updateProduct(id: string, info: ProductInfo): Promise<boolean> {
  try {
    const source = await db.execute(sql`
      SELECT product_id FROM product_sources
      WHERE asp_name = 'Japanska' AND original_product_id = ${id}
    `);

    if (source.rows.length === 0) {
      return false;
    }

    const productId = source.rows[0].product_id;

    // タイトルを更新
    await db.execute(sql`
      UPDATE products
      SET title = ${info.title},
          updated_at = NOW()
      WHERE id = ${productId}
    `);

    // サムネイルも更新（有効な場合）
    if (info.thumbnailUrl && !info.thumbnailUrl.includes('placehold')) {
      await db.execute(sql`
        UPDATE products
        SET default_thumbnail_url = ${info.thumbnailUrl}
        WHERE id = ${productId}
        AND (default_thumbnail_url IS NULL OR default_thumbnail_url LIKE '%placehold%')
      `);
    }

    return true;
  } catch (error) {
    console.error(`  ✗ 更新エラー: ${error}`);
    return false;
  }
}

async function main() {
  console.log('=== Japanska Puppeteerクローラー (一覧ページ経由) ===\n');

  // 更新対象のIDを取得
  const targets = await db.execute(sql`
    SELECT ps.original_product_id
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
    AND (p.title LIKE 'Japanska作品%' OR p.title LIKE 'Japanska-%')
    ORDER BY ps.original_product_id::int DESC
  `);

  const targetIdSet = new Set(targets.rows.map((r: any) => r.original_product_id as string));
  console.log(`更新対象: ${targetIdSet.size}件\n`);

  if (targetIdSet.size === 0) {
    console.log('更新対象なし');
    process.exit(0);
  }

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

  let updated = 0;
  let failed = 0;
  let pageNum = 1;
  const maxPages = 2000; // 安全のため上限
  const processedIds = new Set<string>();

  console.log('一覧ページを巡回して対象IDを探します...\n');

  // 一覧ページを巡回
  while (pageNum <= maxPages && processedIds.size < targetIdSet.size) {
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

    // 対象IDがあるかチェック
    const targetOnThisPage = idsOnPage.filter(id => targetIdSet.has(id) && !processedIds.has(id));

    if (targetOnThisPage.length === 0) {
      console.log('  対象IDなし、次のページへ');
      pageNum++;
      await sleep(1000);
      continue;
    }

    console.log(`  対象ID: ${targetOnThisPage.length}件`);

    // 各対象IDを処理
    for (const id of targetOnThisPage) {
      console.log(`  [${processedIds.size + 1}/${targetIdSet.size}] ID: ${id}`);

      const info = await clickAndFetchDetail(page, id);

      if (info && info.title) {
        console.log(`    ✓ タイトル: ${info.title}`);
        if (info.performers.length > 0) {
          console.log(`    ✓ 出演者: ${info.performers.join(', ')}`);
        }

        const success = await updateProduct(id, info);
        if (success) {
          updated++;
          console.log(`    ✓ 更新完了`);
        } else {
          failed++;
        }
      } else {
        console.log(`    ✗ 取得失敗`);
        failed++;
      }

      processedIds.add(id);
      await sleep(DELAY_MS);
    }

    // 進捗表示
    console.log(`\n--- 進捗: ${processedIds.size}/${targetIdSet.size} (更新: ${updated}, 失敗: ${failed}) ---\n`);

    pageNum++;
    await sleep(1000);
  }

  await browser.close();

  console.log('\n=== 最終結果 ===');
  console.log(`対象: ${targetIdSet.size}件`);
  console.log(`処理: ${processedIds.size}件`);
  console.log(`更新: ${updated}件`);
  console.log(`失敗: ${failed}件`);

  process.exit(0);
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
