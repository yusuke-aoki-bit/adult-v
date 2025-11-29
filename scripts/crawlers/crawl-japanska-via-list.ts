/**
 * Japanska 一覧ページから詳細ページを辿ってタイトルを取得
 * 一覧ページ→詳細ページの順序でアクセスすることでリダイレクトを回避
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

const BASE_URL = 'https://www.japanska-xxx.com';
const LIST_URL = `${BASE_URL}/category/list_0.html`;
const DELAY_MS = 2000; // 2秒待機

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
 * 一覧ページからすべての詳細ページIDを取得
 */
async function fetchListPage(page: number): Promise<string[]> {
  const url = page === 1 ? LIST_URL : `${LIST_URL}?page=${page}`;
  console.log(`📄 一覧ページ取得: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Connection': 'keep-alive',
    },
  });

  if (!response.ok) {
    console.log(`  ✗ ステータス: ${response.status}`);
    return [];
  }

  const html = await response.text();

  // 詳細ページへのリンクを抽出
  const detailLinks = html.matchAll(/href=['"][^'"]*movie\/detail_(\d+)\.html['"]/gi);
  const ids: string[] = [];
  for (const m of detailLinks) {
    if (!ids.includes(m[1])) {
      ids.push(m[1]);
    }
  }

  console.log(`  ✓ ${ids.length}件のIDを発見`);
  return ids;
}

/**
 * 詳細ページからタイトルと出演者を抽出
 */
async function fetchDetailPage(id: string, referer: string): Promise<ProductInfo | null> {
  const url = `${BASE_URL}/movie/detail_${id}.html`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Referer': referer,
      'Connection': 'keep-alive',
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();

  // ホームページへのリダイレクトを検出
  if (html.includes('<!--home.html-->') || (html.includes('幅広いジャンル') && html.includes('30日'))) {
    return null;
  }

  // タイトル抽出
  let title: string | null = null;
  const movieTtlMatch = html.match(/<div[^>]*class="movie_ttl"[^>]*>\s*<p>([^<]+)<\/p>/i);
  if (movieTtlMatch) {
    title = movieTtlMatch[1].trim();
  }

  if (!title) {
    // フォールバック
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }

  if (!title) {
    return null;
  }

  // 出演者抽出
  const performers: string[] = [];
  const performerMatches = html.matchAll(/<a[^>]*href="[^"]*actress_[^"]*"[^>]*>([^<]+)<\/a>/gi);
  for (const m of performerMatches) {
    const name = m[1].trim();
    if (name && !performers.includes(name)) {
      performers.push(name);
    }
  }

  // サムネイル抽出
  let thumbnailUrl: string | null = null;
  const thumbMatch = html.match(/<img[^>]*class="[^"]*movie_image[^"]*"[^>]*src="([^"]+)"/i);
  if (thumbMatch) {
    thumbnailUrl = thumbMatch[1];
    if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
      thumbnailUrl = `${BASE_URL}${thumbnailUrl}`;
    }
  }

  return {
    id,
    title,
    performers,
    thumbnailUrl,
  };
}

/**
 * データベースの商品タイトルを更新
 */
async function updateProduct(id: string, info: ProductInfo): Promise<boolean> {
  try {
    // product_sourcesからproduct_idを取得
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

    return true;
  } catch (error) {
    console.error(`  ✗ 更新エラー: ${error}`);
    return false;
  }
}

async function main() {
  console.log('=== Japanska 一覧経由クローラー ===\n');

  // 更新対象のIDを取得
  const targets = await db.execute(sql`
    SELECT ps.original_product_id
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
    AND (p.title LIKE 'Japanska作品%' OR p.title LIKE 'Japanska-%')
    ORDER BY ps.original_product_id::int
  `);

  const targetIds = new Set(targets.rows.map((r: any) => r.original_product_id));
  console.log(`更新対象: ${targetIds.size}件\n`);

  if (targetIds.size === 0) {
    console.log('更新対象なし');
    process.exit(0);
  }

  let updated = 0;
  let failed = 0;
  let page = 1;
  const maxPages = 500; // 安全のため上限設定
  const foundIds = new Set<string>();

  while (page <= maxPages && foundIds.size < targetIds.size) {
    // 一覧ページを取得
    const ids = await fetchListPage(page);

    if (ids.length === 0) {
      console.log('  一覧ページの終端に到達');
      break;
    }

    const listUrl = page === 1 ? LIST_URL : `${LIST_URL}?page=${page}`;

    // 各詳細ページを処理
    for (const id of ids) {
      // 更新対象かチェック
      if (!targetIds.has(id)) {
        continue;
      }

      // 既に処理済みならスキップ
      if (foundIds.has(id)) {
        continue;
      }

      foundIds.add(id);
      console.log(`  [${foundIds.size}/${targetIds.size}] ID: ${id}`);

      await sleep(DELAY_MS);

      const info = await fetchDetailPage(id, listUrl);

      if (info && info.title) {
        console.log(`    ✓ タイトル: ${info.title}`);

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

      // 進捗表示
      if (foundIds.size % 10 === 0) {
        console.log(`\n--- 進捗: ${foundIds.size}/${targetIds.size} (更新: ${updated}, 失敗: ${failed}) ---\n`);
      }
    }

    page++;
    await sleep(1000); // ページ間で待機
  }

  console.log('\n=== 結果 ===');
  console.log(`対象: ${targetIds.size}件`);
  console.log(`発見: ${foundIds.size}件`);
  console.log(`更新: ${updated}件`);
  console.log(`失敗: ${failed}件`);

  process.exit(0);
}

main().catch(console.error);
