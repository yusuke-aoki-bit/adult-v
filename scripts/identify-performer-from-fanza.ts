/**
 * 品番IDからFANZAで演者を特定し、サイト取得名をエイリアスとして保存
 *
 * 処理フロー:
 * 1. MGS等の商品から品番（200GANA-2920など）を取得
 * 2. FANZAで同じ品番の商品を検索
 * 3. FANZAから正しい演者名を取得
 * 4. 現在リンクされている仮名（例: ゆな 21歳 歯科助手）を正しい演者のエイリアスとして登録
 * 5. 商品を正しい演者にリンク
 *
 * 使用方法:
 * npx tsx scripts/identify-performer-from-fanza.ts --product-id=993560
 * npx tsx scripts/identify-performer-from-fanza.ts --limit=100 --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { sql } from 'drizzle-orm';

// 環境変数を読み込み
function loadEnv() {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envLocalPath)) {
    console.error('.env.local が見つかりません');
    return;
  }
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex);
      let value = trimmed.substring(eqIndex + 1);
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadEnv();

import { db, closeDb } from '../packages/database/src/client';
import { products, performers, productPerformers, performerAliases } from '../packages/database/src/schema';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';

// 除外ワード
const EXCLUDE_TERMS = new Set([
  'AV', 'DVD', '動画', '無修正', 'サンプル', 'ダウンロード',
  '女優', '出演者', '作品', '詳細', '商品', 'おすすめ',
  '新作', '人気', 'ランキング', '全作品', 'プロフィール',
  'ホーム', 'メニュー', '検索', 'カテゴリ', 'タグ',
]);

// 演者名バリデーション（簡易版）
function isValidPerformerName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 30) return false;
  // 除外ワードチェック
  if (EXCLUDE_TERMS.has(name)) return false;
  // 数字のみは除外
  if (/^\d+$/.test(name)) return false;
  // URLっぽい文字列は除外
  if (/^https?:\/\//.test(name) || name.includes('www.')) return false;
  // HTMLタグは除外
  if (/<[^>]+>/.test(name)) return false;
  return true;
}

interface ProductWithPerformer {
  productId: number;
  normalizedProductId: string;
  title: string;
  currentPerformerId: number;
  currentPerformerName: string;
}

/**
 * 品番を正規化して検索用に変換
 */
function normalizeProductCode(code: string): string[] {
  const codes: string[] = [];
  const upper = code.toUpperCase();

  // そのまま追加
  codes.push(upper);

  // MGS-xxx形式からプレフィックスを除去
  if (upper.startsWith('MGS-')) {
    const withoutMgs = upper.replace('MGS-', '');
    codes.push(withoutMgs);
  }

  // ハイフンなしバージョン
  codes.push(upper.replace(/-/g, ''));

  // 数字プレフィックスがある場合の変形
  const match = upper.match(/^(\d+)([A-Z]+)-?(\d+)$/);
  if (match) {
    const [, numPrefix, letters, number] = match;
    codes.push(`${numPrefix}${letters}-${number}`);
    codes.push(`${numPrefix}${letters}${number}`);
    // 先頭ゼロ除去版
    codes.push(`${numPrefix}${letters}-${parseInt(number, 10)}`);
  }

  return [...new Set(codes)];
}

/**
 * 特定の商品IDの情報を取得
 */
async function getProductInfo(productId: number): Promise<ProductWithPerformer | null> {
  const result = await db.execute(sql`
    SELECT
      p.id as product_id,
      p.normalized_product_id,
      p.title,
      pf.id as performer_id,
      pf.name as performer_name
    FROM products p
    JOIN product_performers pp ON p.id = pp.product_id
    JOIN performers pf ON pp.performer_id = pf.id
    WHERE p.id = ${productId}
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as {
    product_id: number;
    normalized_product_id: string;
    title: string;
    performer_id: number;
    performer_name: string;
  };

  return {
    productId: row.product_id,
    normalizedProductId: row.normalized_product_id,
    title: row.title,
    currentPerformerId: row.performer_id,
    currentPerformerName: row.performer_name,
  };
}

/**
 * FANZAで同じ品番の商品を検索
 */
async function findFanzaProductByCode(productCode: string): Promise<{
  productId: number;
  performers: { id: number; name: string }[];
} | null> {
  const searchCodes = normalizeProductCode(productCode);

  console.log(`  検索パターン: ${searchCodes.join(', ')}`);

  // FANZAの商品を検索（normalized_product_idにFANZA-が含まれる）
  const result = await db.execute(sql`
    SELECT
      p.id,
      p.normalized_product_id,
      p.title,
      ARRAY_AGG(DISTINCT pf.name) as performers,
      ARRAY_AGG(DISTINCT pf.id) as performer_ids
    FROM products p
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    LEFT JOIN performers pf ON pp.performer_id = pf.id
    WHERE p.normalized_product_id LIKE 'FANZA-%'
    AND (
      ${sql.join(
        searchCodes.map(
          (code) =>
            sql`UPPER(p.normalized_product_id) LIKE ${'%' + code + '%'}`
        ),
        sql` OR `
      )}
    )
    GROUP BY p.id, p.normalized_product_id, p.title
    LIMIT 5
  `);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as {
    id: number;
    normalized_product_id: string;
    title: string;
    performers: string[];
    performer_ids: number[];
  };

  console.log(`  FANZAで発見: ${row.normalized_product_id} - ${row.title}`);

  // 演者情報を整形
  const performers: { id: number; name: string }[] = [];
  if (row.performers && row.performer_ids) {
    for (let i = 0; i < row.performers.length; i++) {
      if (row.performers[i] && row.performer_ids[i]) {
        performers.push({
          id: row.performer_ids[i],
          name: row.performers[i],
        });
      }
    }
  }

  return {
    productId: row.id,
    performers,
  };
}

/**
 * av-wiki.netで品番を検索して演者名を取得
 */
async function searchAvWiki(productCode: string): Promise<string[]> {
  const formattedCode = productCode.toUpperCase().replace(/([A-Z]+)(\d+)$/, '$1-$2');
  const searchUrl = `https://av-wiki.net/?s=${encodeURIComponent(formattedCode)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) return [];

    const buffer = Buffer.from(await response.arrayBuffer());
    const html = iconv.decode(buffer, 'utf-8');
    const $ = cheerio.load(html);
    const foundPerformers: string[] = [];

    // 検索結果のリストから出演者を抽出
    $('article ul li, .entry-content ul li').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length >= 2 && text.length <= 15 && !EXCLUDE_TERMS.has(text) && !/\d/.test(text)) {
        if (isValidPerformerName(text) && !foundPerformers.includes(text)) {
          foundPerformers.push(text);
        }
      }
    });

    return foundPerformers;
  } catch (error: unknown) {
    console.warn(`[av-wiki] Error:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * shiroutoname.comで品番を検索して演者名を取得
 */
async function searchShiroutoname(productCode: string): Promise<string[]> {
  const formattedCode = productCode.toUpperCase().replace(/([A-Z]+)(\d+)$/, '$1-$2');
  const searchUrl = `https://shiroutoname.com/?s=${encodeURIComponent(formattedCode)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) return [];

    const buffer = Buffer.from(await response.arrayBuffer());
    const html = iconv.decode(buffer, 'utf-8');
    const $ = cheerio.load(html);
    const foundPerformers: string[] = [];

    // 詳細ページへのリンクを探す
    let detailUrl: string | null = null;
    $('a[href*="shiroutoname.com/"]').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      if (href.includes('/siro/') || href.includes('/ara/') || href.includes('/200/') || href.includes('/300/') || href.includes('/gana/')) {
        if (!detailUrl) detailUrl = href;
      }
    });

    if (detailUrl) {
      await new Promise(r => setTimeout(r, 500));
      const detailResponse = await fetch(detailUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });

      if (detailResponse.ok) {
        const detailHtml = await detailResponse.text();
        const $d = cheerio.load(detailHtml);

        // 出演者リンクを探す
        $d('a[href*="/actress/"]').each((_, elem) => {
          const text = $d(elem).text().trim();
          if (text.length >= 2 && text.length <= 15 && !EXCLUDE_TERMS.has(text)) {
            if (isValidPerformerName(text) && !foundPerformers.includes(text)) {
              foundPerformers.push(text);
            }
          }
        });
      }
    }

    return foundPerformers;
  } catch (error: unknown) {
    console.warn(`[shiroutoname] Error:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * wiki_crawl_dataから演者名を検索
 */
async function getPerformersFromWiki(productCode: string): Promise<string[]> {
  const searchCodes = normalizeProductCode(productCode);

  const result = await db.execute(sql`
    SELECT DISTINCT performer_name
    FROM wiki_crawl_data
    WHERE UPPER(product_code) = ANY(ARRAY[${sql.join(
      searchCodes.map((c) => sql`${c.toUpperCase()}`),
      sql`, `
    )}]::text[])
  `);

  return (result.rows as { performer_name: string }[])
    .map((row) => row.performer_name)
    .filter((name) => name && name.length > 0);
}

/**
 * 仮名演者を正しい演者にマージ
 * - 仮名演者にリンクされている全商品を正しい演者に移行
 * - 仮名を正しい演者のエイリアスとして登録
 * - 仮名演者レコードを削除
 */
async function mergePerformerIntoCorrect(
  wrongPerformerId: number,
  wrongPerformerName: string,
  correctPerformerId: number,
  correctPerformerName: string,
  source: string = 'mgs-nanpa-alias',
  dryRun: boolean = false
): Promise<{ productsMoved: number; aliasAdded: boolean }> {
  console.log(`\n🔀 演者マージ処理...`);
  console.log(`  仮名: ${wrongPerformerName} (ID: ${wrongPerformerId})`);
  console.log(`  正解: ${correctPerformerName} (ID: ${correctPerformerId})`);

  // 1. 仮名演者にリンクされている商品を取得
  const linkedProducts = await db.execute(sql`
    SELECT product_id FROM product_performers
    WHERE performer_id = ${wrongPerformerId}
  `);

  const productIds = (linkedProducts.rows as { product_id: number }[]).map(r => r.product_id);
  console.log(`  → ${productIds.length}件の商品がリンクされています`);

  if (dryRun) {
    console.log(`  [DRY-RUN] 以下の操作を実行予定:`);
    console.log(`    1. ${productIds.length}件の商品を ${correctPerformerName} に移行`);
    console.log(`    2. 「${wrongPerformerName}」を ${correctPerformerName} のエイリアスとして登録`);
    console.log(`    3. 仮名演者レコード(ID:${wrongPerformerId})を削除`);
    return { productsMoved: productIds.length, aliasAdded: false };
  }

  // 2. 商品リンクを正しい演者に移行
  let productsMoved = 0;
  for (const productId of productIds) {
    // 既に正しい演者にリンクされているかチェック
    const existingLink = await db.execute(sql`
      SELECT 1 FROM product_performers
      WHERE product_id = ${productId} AND performer_id = ${correctPerformerId}
      LIMIT 1
    `);

    if (existingLink.rows.length === 0) {
      // 正しい演者へのリンクを追加
      await db.execute(sql`
        INSERT INTO product_performers (product_id, performer_id)
        VALUES (${productId}, ${correctPerformerId})
        ON CONFLICT DO NOTHING
      `);
      productsMoved++;
    }

    // 仮名演者へのリンクを削除
    await db.execute(sql`
      DELETE FROM product_performers
      WHERE product_id = ${productId} AND performer_id = ${wrongPerformerId}
    `);
  }
  console.log(`  ✓ ${productsMoved}件の商品を移行`);

  // 3. 仮名をエイリアスとして登録
  let aliasAdded = false;
  const existingAlias = await db.execute(sql`
    SELECT 1 FROM performer_aliases
    WHERE performer_id = ${correctPerformerId} AND alias_name = ${wrongPerformerName}
    LIMIT 1
  `);

  if (existingAlias.rows.length === 0) {
    await db.execute(sql`
      INSERT INTO performer_aliases (performer_id, alias_name, source)
      VALUES (${correctPerformerId}, ${wrongPerformerName}, ${source})
      ON CONFLICT DO NOTHING
    `);
    aliasAdded = true;
    console.log(`  ✓ エイリアス「${wrongPerformerName}」を登録`);
  } else {
    console.log(`  ℹ️ エイリアス「${wrongPerformerName}」は既に登録済み`);
  }

  // 4. 仮名演者レコードを削除（リンクがなくなった場合のみ）
  const remainingLinks = await db.execute(sql`
    SELECT 1 FROM product_performers WHERE performer_id = ${wrongPerformerId} LIMIT 1
  `);

  if (remainingLinks.rows.length === 0) {
    // 仮名演者の既存エイリアスを正しい演者に移行
    await db.execute(sql`
      UPDATE performer_aliases
      SET performer_id = ${correctPerformerId}
      WHERE performer_id = ${wrongPerformerId}
      AND alias_name NOT IN (
        SELECT alias_name FROM performer_aliases WHERE performer_id = ${correctPerformerId}
      )
    `);

    // 重複するエイリアスを削除
    await db.execute(sql`
      DELETE FROM performer_aliases WHERE performer_id = ${wrongPerformerId}
    `);

    // 仮名演者レコードを削除
    await db.execute(sql`
      DELETE FROM performers WHERE id = ${wrongPerformerId}
    `);
    console.log(`  ✓ 仮名演者レコード(ID:${wrongPerformerId})を削除`);
  }

  return { productsMoved, aliasAdded };
}


/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  const productIdArg = args.find((a) => a.startsWith('--product-id='));
  const dryRun = args.includes('--dry-run');

  if (!productIdArg) {
    console.log('使用方法: npx tsx scripts/identify-performer-from-fanza.ts --product-id=993560');
    process.exit(1);
  }

  const productId = parseInt(productIdArg.split('=')[1], 10);
  console.log(`\n=== 商品 ${productId} の演者特定 ===\n`);

  if (dryRun) {
    console.log('※ ドライランモード - データベースは更新されません\n');
  }

  // 1. 商品情報を取得
  const product = await getProductInfo(productId);
  if (!product) {
    console.log('商品が見つからないか、演者がリンクされていません');
    await closeDb();
    return;
  }

  console.log(`商品情報:`);
  console.log(`  ID: ${product.productId}`);
  console.log(`  品番: ${product.normalizedProductId}`);
  console.log(`  タイトル: ${product.title.substring(0, 50)}...`);
  console.log(`  現在の演者: ${product.currentPerformerName} (ID: ${product.currentPerformerId})`);

  // 品番から品番コードを抽出（MGS-200GANA-2920 → 200GANA-2920）
  const productCode = product.normalizedProductId
    .replace(/^[A-Z]+-/, '')
    .toUpperCase();

  console.log(`\n品番コード: ${productCode}`);

  // 2. wiki_crawl_dataから演者を検索
  console.log(`\n📚 wiki_crawl_dataを検索...`);
  const wikiPerformers = await getPerformersFromWiki(productCode);
  if (wikiPerformers.length > 0) {
    console.log(`  wiki演者: ${wikiPerformers.join(', ')}`);
  } else {
    console.log(`  wiki_crawl_dataにデータなし`);
  }

  // 3. FANZAで同じ品番の商品を検索
  console.log(`\n🔍 FANZAで同じ品番を検索...`);
  const fanzaProduct = await findFanzaProductByCode(productCode);

  if (!fanzaProduct) {
    console.log(`  FANZAに同じ品番の商品が見つかりませんでした`);
  } else {
    console.log(`  FANZA演者: ${fanzaProduct.performers.map(p => p.name).join(', ') || '(なし)'}`);
  }

  // 4. 外部サイトで検索（DBに情報がない場合）
  let externalPerformers: string[] = [];
  if (wikiPerformers.length === 0 && (!fanzaProduct || fanzaProduct.performers.length === 0)) {
    console.log(`\n🌐 外部サイトで検索...`);

    // av-wiki.netで検索
    console.log(`  av-wiki.netを検索中...`);
    const avWikiResults = await searchAvWiki(productCode);
    if (avWikiResults.length > 0) {
      console.log(`    結果: ${avWikiResults.join(', ')}`);
      externalPerformers = [...externalPerformers, ...avWikiResults];
    } else {
      console.log(`    結果なし`);
    }

    // shiroutoname.comで検索
    console.log(`  shiroutoname.comを検索中...`);
    const shiroutoResults = await searchShiroutoname(productCode);
    if (shiroutoResults.length > 0) {
      console.log(`    結果: ${shiroutoResults.join(', ')}`);
      externalPerformers = [...externalPerformers, ...shiroutoResults];
    } else {
      console.log(`    結果なし`);
    }

    // 重複除去
    externalPerformers = [...new Set(externalPerformers)];
  }

  // 5. 正しい演者を特定（優先度: wiki > FANZA > 外部サイト）
  let correctPerformerName: string | null = null;
  let correctPerformerId: number | null = null;
  let source = '';

  if (wikiPerformers.length > 0) {
    correctPerformerName = wikiPerformers[0];
    source = 'wiki_crawl_data';
    console.log(`\n✓ wiki_crawl_dataから特定: ${correctPerformerName}`);
  } else if (fanzaProduct && fanzaProduct.performers.length > 0) {
    correctPerformerName = fanzaProduct.performers[0].name;
    correctPerformerId = fanzaProduct.performers[0].id;
    source = 'FANZA DB';
    console.log(`\n✓ FANZAから特定: ${correctPerformerName} (ID: ${correctPerformerId})`);
  } else if (externalPerformers.length > 0) {
    correctPerformerName = externalPerformers[0];
    source = '外部サイト';
    console.log(`\n✓ 外部サイトから特定: ${correctPerformerName}`);
  }

  if (!correctPerformerName) {
    console.log(`\n❌ 正しい演者を特定できませんでした`);
    console.log(`  → 手動でwiki_crawl_dataに追加するか、別の方法で演者を特定してください`);
    await closeDb();
    return;
  }

  // 演者IDを取得（wikiの場合）
  if (!correctPerformerId && correctPerformerName) {
    const performerResult = await db.execute(sql`
      SELECT id FROM performers WHERE name = ${correctPerformerName} LIMIT 1
    `);
    if (performerResult.rows.length > 0) {
      correctPerformerId = (performerResult.rows[0] as { id: number }).id;
    } else {
      // 演者が存在しない場合は作成
      if (!dryRun) {
        const insertResult = await db.execute(sql`
          INSERT INTO performers (name)
          VALUES (${correctPerformerName})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `);
        correctPerformerId = (insertResult.rows[0] as { id: number }).id;
        console.log(`  新規演者を作成: ${correctPerformerName} (ID: ${correctPerformerId})`);
      } else {
        console.log(`  [DRY-RUN] 新規演者を作成: ${correctPerformerName}`);
      }
    }
  }

  // 6. 現在の演者名と正しい演者名を比較
  if (product.currentPerformerName === correctPerformerName) {
    console.log(`\n✓ 既に正しい演者にリンクされています`);
    await closeDb();
    return;
  }

  console.log(`\n修正内容:`);
  console.log(`  現在: ${product.currentPerformerName} (ID: ${product.currentPerformerId})`);
  console.log(`  正解: ${correctPerformerName} (ID: ${correctPerformerId})`);
  console.log(`  仮名「${product.currentPerformerName}」をエイリアスとして保存し、全商品を移行`);

  if (!correctPerformerId) {
    console.log(`\n❌ 正しい演者IDが取得できませんでした`);
    await closeDb();
    return;
  }

  // 7. 仮名演者を正しい演者にマージ
  // - 仮名演者にリンクされている全商品を正しい演者に移行
  // - 仮名を正しい演者のエイリアスとして登録
  // - 仮名演者レコードを削除
  await mergePerformerIntoCorrect(
    product.currentPerformerId,
    product.currentPerformerName,
    correctPerformerId,
    correctPerformerName,
    'mgs-nanpa-alias',
    dryRun
  );

  console.log(`\n✅ 完了`);
  await closeDb();
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
