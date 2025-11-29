/**
 * Japanska セッション維持クローラー
 * 一覧ページでセッションを確立してから、詳細ページに直接アクセス
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

const BASE_URL = 'https://www.japanska-xxx.com';
const LIST_URL = `${BASE_URL}/category/list_0.html`;
const DELAY_MS = 1500;

// セッション用のCookieを保持
let sessionCookies = '';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 一覧ページにアクセスしてセッションを確立
 */
async function establishSession(): Promise<boolean> {
  console.log('セッション確立中...');

  const response = await fetch(LIST_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) {
    console.log(`  ✗ ステータス: ${response.status}`);
    return false;
  }

  // Set-Cookieヘッダーを取得
  const setCookies = response.headers.getSetCookie?.() || [];
  if (setCookies.length > 0) {
    sessionCookies = setCookies
      .map((c: string) => c.split(';')[0])
      .join('; ');
    console.log(`  ✓ Cookie取得: ${sessionCookies.substring(0, 50)}...`);
  } else {
    // response.headers.raw() も試す
    const rawCookies = response.headers.get('set-cookie');
    if (rawCookies) {
      sessionCookies = rawCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
      console.log(`  ✓ Cookie取得(raw): ${sessionCookies.substring(0, 50)}...`);
    } else {
      console.log('  ⚠ Cookieなし');
    }
  }

  const html = await response.text();
  console.log(`  ✓ 一覧ページ取得: ${html.length} bytes`);

  return true;
}

/**
 * 詳細ページからタイトルを取得
 */
async function fetchDetailPage(id: string): Promise<{ title: string | null; performers: string[] }> {
  const url = `${BASE_URL}/movie/detail_${id}.html`;

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Referer': LIST_URL,
  };

  if (sessionCookies) {
    headers['Cookie'] = sessionCookies;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    return { title: null, performers: [] };
  }

  const html = await response.text();

  // ホームページへのリダイレクトを検出
  if (html.includes('<!--home.html-->') || (html.includes('幅広いジャンル') && html.includes('30日'))) {
    return { title: null, performers: [] };
  }

  // タイトル抽出
  let title: string | null = null;
  const movieTtlMatch = html.match(/<div[^>]*class="movie_ttl"[^>]*>\s*<p>([^<]+)<\/p>/i);
  if (movieTtlMatch) {
    title = movieTtlMatch[1].trim();
  }

  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      title = h1Match[1].trim();
    }
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

  return { title, performers };
}

/**
 * データベースの商品タイトルを更新
 */
async function updateProduct(id: string, title: string): Promise<boolean> {
  try {
    const source = await db.execute(sql`
      SELECT product_id FROM product_sources
      WHERE asp_name = 'Japanska' AND original_product_id = ${id}
    `);

    if (source.rows.length === 0) {
      return false;
    }

    const productId = source.rows[0].product_id;

    await db.execute(sql`
      UPDATE products
      SET title = ${title}, updated_at = NOW()
      WHERE id = ${productId}
    `);

    return true;
  } catch (error) {
    console.error(`  ✗ 更新エラー: ${error}`);
    return false;
  }
}

async function main() {
  console.log('=== Japanska セッション維持クローラー ===\n');

  // セッション確立
  const sessionOk = await establishSession();
  if (!sessionOk) {
    console.log('セッション確立失敗');
    process.exit(1);
  }

  await sleep(1000);

  // 更新対象のIDを取得
  const targets = await db.execute(sql`
    SELECT ps.original_product_id
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
    AND (p.title LIKE 'Japanska作品%' OR p.title LIKE 'Japanska-%')
    ORDER BY ps.original_product_id::int DESC
  `);

  const targetIds = targets.rows.map((r: any) => r.original_product_id);
  console.log(`\n更新対象: ${targetIds.length}件\n`);

  if (targetIds.length === 0) {
    console.log('更新対象なし');
    process.exit(0);
  }

  let updated = 0;
  let failed = 0;

  // まず数件テスト
  const testIds = targetIds.slice(0, 5);
  console.log('=== テスト実行 (先頭5件) ===\n');

  for (const id of testIds) {
    console.log(`[${updated + failed + 1}/${testIds.length}] ID: ${id}`);

    await sleep(DELAY_MS);

    const result = await fetchDetailPage(id);

    if (result.title) {
      console.log(`  ✓ タイトル: ${result.title}`);
      if (result.performers.length > 0) {
        console.log(`  ✓ 出演者: ${result.performers.join(', ')}`);
      }

      const success = await updateProduct(id, result.title);
      if (success) {
        updated++;
        console.log(`  ✓ 更新完了`);
      } else {
        failed++;
      }
    } else {
      console.log(`  ✗ 取得失敗（ホームページにリダイレクト）`);
      failed++;
    }
  }

  console.log('\n=== テスト結果 ===');
  console.log(`対象: ${testIds.length}件`);
  console.log(`更新: ${updated}件`);
  console.log(`失敗: ${failed}件`);

  if (updated === 0) {
    console.log('\n⚠ セッション維持でも取得できませんでした。');
    console.log('Puppeteer（ヘッドレスブラウザ）が必要な可能性があります。');
    process.exit(1);
  }

  // 残りを処理
  const remainingIds = targetIds.slice(5);
  if (remainingIds.length > 0 && updated > 0) {
    console.log(`\n=== 残り ${remainingIds.length}件を処理中 ===\n`);

    for (let i = 0; i < remainingIds.length; i++) {
      const id = remainingIds[i];
      console.log(`[${i + 1 + 5}/${targetIds.length}] ID: ${id}`);

      await sleep(DELAY_MS);

      const result = await fetchDetailPage(id);

      if (result.title) {
        console.log(`  ✓ タイトル: ${result.title.substring(0, 50)}...`);
        const success = await updateProduct(id, result.title);
        if (success) {
          updated++;
        } else {
          failed++;
        }
      } else {
        console.log(`  ✗ 取得失敗`);
        failed++;
      }

      // 10件ごとにセッション再確立
      if ((i + 1) % 10 === 0) {
        console.log('\n--- セッション再確立 ---');
        await establishSession();
        await sleep(1000);
        console.log('');
      }
    }
  }

  console.log('\n=== 最終結果 ===');
  console.log(`対象: ${targetIds.length}件`);
  console.log(`更新: ${updated}件`);
  console.log(`失敗: ${failed}件`);

  process.exit(0);
}

main().catch(console.error);
