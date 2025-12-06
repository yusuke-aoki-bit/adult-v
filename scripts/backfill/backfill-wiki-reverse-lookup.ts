/**
 * Wiki逆引きでnum-alphaパターンの製品に出演者を紐付ける
 * AVソムリエ、SIRO-HAME等のWikiサイトから品番検索
 */

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db/index.js';
import { productPerformers } from '../../lib/db/schema.js';
import { sql } from 'drizzle-orm';
import { isValidPerformerName } from '../../lib/performer-validation.js';

const db = getDb();
const RATE_LIMIT_MS = 2500;

/**
 * 品番を検索用形式に変換
 * 例: 259luxu1234 → 259LUXU-1234
 */
function formatProductCode(code: string): string {
  // 数字とアルファベットを分離
  const match = code.match(/^(\d+)([a-zA-Z]+)(\d+)$/);
  if (match) {
    return `${match[1]}${match[2].toUpperCase()}-${match[3]}`;
  }
  return code.toUpperCase();
}

/**
 * AVソムリエで品番検索
 */
async function lookupFromAvSommelier(productCode: string): Promise<string[]> {
  const performers: string[] = [];
  try {
    const formattedCode = formatProductCode(productCode);
    const searchUrl = `https://av-sommelier.com/?s=${encodeURIComponent(formattedCode)}`;

    console.log(`  Search: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return performers;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 検索結果から最初の記事リンクを取得
    let detailUrl = '';
    const titleLink = $('h2.entry-title a').first().attr('href');
    if (titleLink) {
      detailUrl = titleLink;
    }

    if (!detailUrl) {
      return performers;
    }

    // 詳細ページをフェッチ
    const detailResponse = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!detailResponse.ok) {
      return performers;
    }

    const detailHtml = await detailResponse.text();
    const $detail = cheerio.load(detailHtml);

    // 出演者抽出
    // パターン1: 「出演：」「女優：」
    $detail('p, div').each((_, elem) => {
      const text = $detail(elem).text();
      const actressMatch = text.match(/(?:出演|女優)[：:]\s*(.+?)(?:\s|$)/);
      if (actressMatch) {
        const names = actressMatch[1].split(/[、,\s]+/);
        names.forEach(name => {
          const trimmed = name.trim();
          if (trimmed.length >= 2 && trimmed.length <= 20 && !performers.includes(trimmed)) {
            if (isValidPerformerName(trimmed)) {
              performers.push(trimmed);
            }
          }
        });
      }
    });

    // パターン2: タグから抽出
    $detail('a[rel="tag"]').each((_, elem) => {
      const name = $detail(elem).text().trim();
      if (name.length >= 2 && name.length <= 20 && !performers.includes(name)) {
        if (isValidPerformerName(name)) {
          performers.push(name);
        }
      }
    });

    return performers;
  } catch (e) {
    console.error('  Error:', e);
    return performers;
  }
}

/**
 * MGS公式から出演者を取得
 */
async function lookupFromMgs(productCode: string): Promise<string[]> {
  const performerList: string[] = [];
  try {
    const formattedCode = formatProductCode(productCode);
    const url = `https://www.mgstage.com/product/product_detail/${formattedCode}/`;

    console.log(`  MGS: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
        'Cookie': 'adc=1',
      },
      redirect: 'manual', // リダイレクトを手動で確認
    });

    // 302リダイレクトの場合は存在しない
    if (response.status === 302) {
      return performerList;
    }

    if (!response.ok) {
      return performerList;
    }

    const html = await response.text();

    // トップページにリダイレクトされた場合
    if (html.includes('MGS動画へようこそ') || !html.includes('product_detail')) {
      return performerList;
    }

    const $ = cheerio.load(html);

    // 出演者を取得
    $('th:contains("出演")').next('td').find('a').each((_, elem) => {
      let name = $(elem).text().trim();
      // 「しずくさん 29歳 美容部員」→「しずくさん」
      const match = name.match(/^([ぁ-んァ-ヶー一-龯a-zA-Z]+)/);
      if (match) {
        name = match[1];
      }
      if (name && isValidPerformerName(name) && !performerList.includes(name)) {
        performerList.push(name);
      }
    });

    // meta descriptionからも抽出
    const metaDesc = $('meta[name="Description"]').attr('content') || '';
    const descMatch = metaDesc.match(/^([ぁ-んァ-ヶー一-龯a-zA-Z]+)\s*\d+歳/);
    if (descMatch && isValidPerformerName(descMatch[1]) && !performerList.includes(descMatch[1])) {
      performerList.push(descMatch[1]);
    }

    return performerList;
  } catch (e) {
    return performerList;
  }
}

/**
 * SIRO-HAMEで品番検索
 */
async function lookupFromSiroHame(productCode: string): Promise<string[]> {
  const performers: string[] = [];
  try {
    const formattedCode = formatProductCode(productCode);
    const searchUrl = `https://www.siro-hame.com/?s=${encodeURIComponent(formattedCode)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return performers;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 検索結果から出演者名を抽出
    $('a[href*="/actress/"]').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name.length >= 2 && name.length <= 20 && !performers.includes(name)) {
        if (isValidPerformerName(name)) {
          performers.push(name);
        }
      }
    });

    return performers;
  } catch (e) {
    return performers;
  }
}

/**
 * av-wiki.netで品番検索
 * 300MIUM, 300NTK, 300MAAN等の素人系に有効
 */
async function lookupFromAvWiki(productCode: string): Promise<string[]> {
  const performerList: string[] = [];
  try {
    const formattedCode = formatProductCode(productCode);
    const searchUrl = `https://av-wiki.net/?s=${encodeURIComponent(formattedCode)}`;

    console.log(`  AV-Wiki: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return performerList;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 検索結果がない場合
    if (html.includes('見つかりませんでした') || html.includes('何も見つかりません') || html.includes('Nothing Found')) {
      return performerList;
    }

    // 除外するタグ/キーワード
    const excludeTerms = new Set([
      '素人', '巨乳', '美乳', '中出し', 'フェラ', '騎乗位', 'OL', '人妻', 'ギャル', 'ナンパ',
      '女子大生', '痴女', '熟女', '美女', '美人', '爆乳', 'パイズリ', '手コキ', 'アナル',
      'レズ', '3P', '乱交', 'ハメ撮り', '個撮', '潮吹き', '中出', '顔射', 'ごっくん',
      '逆ナン', '寝取', 'NTR', 'NTRリバース', 'MGS', 'プレステージ', 'シロウト', '素人ナンパ',
    ]);

    // 品番パターン（除外用）
    const productCodePattern = /^\d{3}[A-Z]+-\d+$/i;

    // パターン1: 検索結果ページのリスト（ul li）から直接抽出
    $('article ul li, .entry-content ul li, .post ul li').each((_, elem) => {
      const text = $(elem).text().trim();
      // 品番やシリーズ名は除外
      if (productCodePattern.test(text)) return;
      if (excludeTerms.has(text)) return;
      // 長すぎるものは除外（シリーズ名など）
      if (text.length < 2 || text.length > 10) return;
      // 数字を含むものは除外
      if (/\d/.test(text)) return;

      if (isValidPerformerName(text) && !performerList.includes(text)) {
        performerList.push(text);
      }
    });

    // パターン2: 詳細ページへのリンクを取得して追加抽出
    if (performerList.length === 0) {
      const detailLink = $('a[href*="av-wiki.net/"]:not([href*="mgstage"])').first().attr('href');
      if (detailLink && detailLink.includes('av-wiki.net')) {
        await new Promise(r => setTimeout(r, 500));
        const detailResponse = await fetch(detailLink, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'ja-JP,ja;q=0.9',
          },
        });

        if (detailResponse.ok) {
          const detailHtml = await detailResponse.text();
          const $detail = cheerio.load(detailHtml);

          // 女優ページへのリンクから抽出
          $detail('a[href*="/actress/"], a[href*="/tag/"]').each((_, elem) => {
            const name = $detail(elem).text().trim();
            if (name.length >= 2 && name.length <= 10 && !excludeTerms.has(name) && !performerList.includes(name)) {
              if (isValidPerformerName(name)) {
                performerList.push(name);
              }
            }
          });

          // ulリストからも抽出
          $detail('article ul li, .entry-content ul li').each((_, elem) => {
            const text = $detail(elem).text().trim();
            if (productCodePattern.test(text)) return;
            if (excludeTerms.has(text)) return;
            if (text.length < 2 || text.length > 10) return;
            if (/\d/.test(text)) return;

            if (isValidPerformerName(text) && !performerList.includes(text)) {
              performerList.push(text);
            }
          });
        }
      }
    }

    return performerList;
  } catch (e) {
    console.error('  AV-Wiki Error:', e);
    return performerList;
  }
}

async function findOrCreatePerformer(name: string): Promise<number | null> {
  try {
    // 既存の出演者を検索
    const existing = await db.execute(sql`
      SELECT id FROM performers WHERE name = ${name} LIMIT 1
    `);

    if (existing.rows.length > 0) {
      return (existing.rows[0] as any).id;
    }

    // 新規作成
    const newPerformer = await db.execute(sql`
      INSERT INTO performers (name) VALUES (${name})
      ON CONFLICT (name) DO NOTHING
      RETURNING id
    `);

    if (newPerformer.rows.length > 0) {
      return (newPerformer.rows[0] as any).id;
    }

    // 競合の場合は再検索
    const retry = await db.execute(sql`
      SELECT id FROM performers WHERE name = ${name} LIMIT 1
    `);
    return retry.rows.length > 0 ? (retry.rows[0] as any).id : null;
  } catch {
    // エラー時は既存を検索
    const fallback = await db.execute(sql`
      SELECT id FROM performers WHERE name = ${name} LIMIT 1
    `);
    return fallback.rows.length > 0 ? (fallback.rows[0] as any).id : null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '100');
  const prefix = args.find((a) => a.startsWith('--prefix='))?.split('=')[1] || '';

  console.log('=== Wiki逆引きで出演者紐付け ===\n');
  if (dryRun) {
    console.log('⚠️  DRY RUN モード（--execute で実行）\n');
  }
  console.log(`Limit: ${limit}`);
  console.log(`Prefix: ${prefix || '(num-alpha全般)'}\n`);

  // 未紐付きのnum-alpha製品を取得
  let query;
  if (prefix) {
    query = sql`
      SELECT p.id, p.normalized_product_id, p.title
      FROM products p
      WHERE NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
      AND p.normalized_product_id ~ ${'^' + prefix}
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
  } else {
    query = sql`
      SELECT p.id, p.normalized_product_id, p.title
      FROM products p
      WHERE NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
      AND p.normalized_product_id ~ '^[0-9]+[a-zA-Z]+'
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
  }

  const result = await db.execute(query);
  const products = result.rows as any[];
  console.log(`✅ 対象製品: ${products.length}件\n`);

  let processed = 0;
  let found = 0;
  let newRelations = 0;

  for (const product of products) {
    console.log(`[${processed + 1}/${products.length}] ${product.normalized_product_id}`);

    // まずMGS公式を試す
    let performerNames = await lookupFromMgs(product.normalized_product_id);

    // 見つからなければav-wiki.netを試す（300MIUM, 300NTK, 300MAAN等に有効）
    if (performerNames.length === 0) {
      performerNames = await lookupFromAvWiki(product.normalized_product_id);
    }

    // それでも見つからなければAVソムリエを試す
    if (performerNames.length === 0) {
      performerNames = await lookupFromAvSommelier(product.normalized_product_id);
    }

    if (performerNames.length > 0) {
      found++;
      console.log(`  → 出演者: ${performerNames.join(', ')}`);

      if (!dryRun) {
        for (const name of performerNames) {
          try {
            const performerId = await findOrCreatePerformer(name);
            if (performerId) {
              await db
                .insert(productPerformers)
                .values({
                  productId: product.id,
                  performerId: performerId,
                })
                .onConflictDoNothing();
              newRelations++;
            }
          } catch (e) {
            // ignore
          }
        }
      } else {
        newRelations += performerNames.length;
      }
    } else {
      console.log(`  → 見つかりませんでした`);
    }

    processed++;
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  console.log('\n=== 結果 ===');
  console.log(`処理済み: ${processed}件`);
  console.log(`取得成功: ${found}件`);
  console.log(`紐付け: ${newRelations}件`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN モード。実行するには --execute オプションを付けてください');
  } else {
    console.log('\n✅ 処理完了');
  }

  process.exit(0);
}

main().catch(console.error);
