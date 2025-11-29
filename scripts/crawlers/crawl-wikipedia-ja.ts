/**
 * Wikipedia日本語版から女優の別名・作品情報をクロールするスクリプト
 * MediaWiki APIを使用（stealth不要）
 *
 * 取得対象:
 * - 別名（旧芸名、他名義）
 * - 作品リストから品番を抽出
 */

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db';
import { performers, performerAliases, products, productPerformers } from '../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const WIKI_API_URL = 'https://ja.wikipedia.org/w/api.php';

interface ActressData {
  name: string;
  aliases: string[];
  productIds: string[];  // 品番のみ
}

/**
 * Wikipedia APIでページHTMLを取得
 */
async function fetchWikipediaPage(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    format: 'json',
    prop: 'text',
    redirects: '1',  // リダイレクトを自動追従
  });

  try {
    const response = await fetch(`${WIKI_API_URL}?${params}`, {
      headers: {
        'User-Agent': 'ActressInfoBot/1.0 (https://example.com; contact@example.com)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`  HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.error) {
      if (data.error.code === 'missingtitle') {
        console.log(`  Not found`);
      } else {
        console.log(`  Error: ${data.error.info}`);
      }
      return null;
    }

    return data.parse?.text?.['*'] || null;
  } catch (error) {
    console.error(`  Fetch error:`, error);
    return null;
  }
}

/**
 * HTMLから別名を抽出
 */
function extractAliases(html: string, actressName: string): string[] {
  const $ = cheerio.load(html);
  const aliases: string[] = [];

  // infobox から別名を抽出
  $('table.infobox tr').each((_, row) => {
    const $row = $(row);
    const header = $row.find('th').text().trim().toLowerCase();
    const $td = $row.find('td');

    if (!header) return;

    // 別名関連のフィールド
    if (
      header.includes('別名') ||
      header.includes('旧芸名') ||
      header.includes('他名義') ||
      header.includes('別名義')
    ) {
      // brタグで区切られている場合も考慮してHTMLから抽出
      const tdHtml = $td.html() || '';
      // brタグを改行に変換
      const normalizedText = tdHtml.replace(/<br\s*\/?>/gi, '\n');
      const $temp = cheerio.load(`<div>${normalizedText}</div>`);
      const textContent = $temp('div').text();

      // カンマ、読点、スラッシュ、改行で分割
      const parts = textContent.split(/[,、/／\n]/).map(a => a.trim()).filter(a => {
        // 空文字、現在の名前、説明的なテキスト、括弧内の注釈を除外
        const cleaned = a.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').trim();
        return cleaned.length > 0 &&
               cleaned.length < 20 &&  // 長すぎるものは説明文
               cleaned !== actressName &&
               !cleaned.includes('など') &&
               !cleaned.includes('→') &&
               !cleaned.includes('の') &&  // 「〇〇の愛称」などを除外
               !/^[a-zA-Z\s]+$/.test(cleaned);  // 英語のみは除外（中華圈表記は含める）
      });

      // 括弧内の中華圈表記などを個別に抽出
      const bracketMatches = textContent.match(/（([^）]+)）/g);
      if (bracketMatches) {
        for (const m of bracketMatches) {
          const inner = m.replace(/[（）]/g, '').trim();
          // 「中華圈」を含む場合、その前の名前を抽出
          if (inner.includes('中華圈') || inner.includes('中国')) {
            // この場合は含めない（注釈なので）
          } else if (inner.length < 15 && !inner.includes('の')) {
            parts.push(inner);
          }
        }
      }

      aliases.push(...parts);
    }

    // 愛称は別途処理（連結を防ぐ）
    if (header.includes('愛称')) {
      const tdHtml = $td.html() || '';
      const normalizedText = tdHtml.replace(/<br\s*\/?>/gi, '\n');
      const $temp = cheerio.load(`<div>${normalizedText}</div>`);
      const textContent = $temp('div').text();

      const parts = textContent.split(/[,、/／\n]/).map(a => a.trim()).filter(a => {
        return a.length > 0 &&
               a.length < 15 &&
               a !== actressName &&
               !a.includes('など');
      });
      aliases.push(...parts);
    }
  });

  // ページ冒頭の括弧内の別名も抽出
  // 例: 〇〇（旧芸名: △△、〇〇とも）
  const leadText = $('div.mw-parser-output > p').first().text();
  const namePatterns = [
    /旧芸名[：:]\s*([^、,。）]+)/g,
    /別名[：:]\s*([^、,。）]+)/g,
    /旧名[：:]\s*([^、,。）]+)/g,
  ];

  for (const pattern of namePatterns) {
    let match;
    while ((match = pattern.exec(leadText)) !== null) {
      const alias = match[1].trim();
      if (alias && alias !== actressName && alias.length < 20) {
        aliases.push(alias);
      }
    }
  }

  // 重複を除去して返却
  return [...new Set(aliases)].filter(a => a.length >= 2);
}

/**
 * HTMLから品番を抽出
 */
function extractProductIds(html: string): string[] {
  const $ = cheerio.load(html);
  const foundProducts = new Set<string>();

  // 品番パターン: ABC-123 形式
  const productPattern = /([A-Z]{2,10}-?\d{2,5})/gi;

  // 作品一覧セクションを探す
  const worksSections = ['作品', '出演作品', 'AV作品', 'アダルトビデオ', '映像作品'];
  let inWorksSection = false;

  $('h2, h3, table, ul, ol').each((_, elem) => {
    const $elem = $(elem);
    const tagName = elem.tagName.toLowerCase();

    // セクション見出しをチェック
    if (tagName === 'h2' || tagName === 'h3') {
      const headlineText = $elem.find('.mw-headline').text().trim();
      inWorksSection = worksSections.some(s => headlineText.includes(s));
    }

    // 作品セクション内のテーブルから品番を抽出
    if (inWorksSection && tagName === 'table') {
      $elem.find('td').each((_, cell) => {
        const text = $(cell).text().trim();
        const matches = text.match(productPattern);
        if (matches) {
          matches.forEach(m => foundProducts.add(m.toUpperCase()));
        }
      });
    }

    // 作品セクション内のリストから品番を抽出
    if (inWorksSection && (tagName === 'ul' || tagName === 'ol')) {
      $elem.find('li').each((_, item) => {
        const text = $(item).text().trim();
        const matches = text.match(productPattern);
        if (matches) {
          matches.forEach(m => foundProducts.add(m.toUpperCase()));
        }
      });
    }
  });

  // ページ全体からも品番を探す（補助的）
  $('table tr td, li').each((_, cell) => {
    const text = $(cell).text().trim();
    // 明らかに品番っぽいパターンのみ
    const strictPattern = /\b([A-Z]{2,5}-\d{3,5})\b/g;
    const matches = text.match(strictPattern);
    if (matches) {
      matches.forEach(m => foundProducts.add(m.toUpperCase()));
    }
  });

  return Array.from(foundProducts);
}

/**
 * 女優ページをクロール
 */
async function fetchActressPage(actressName: string): Promise<ActressData | null> {
  console.log(`  Fetching Wikipedia: ${actressName}`);

  const html = await fetchWikipediaPage(actressName);
  if (!html) {
    return null;
  }

  const aliases = extractAliases(html, actressName);
  const productIds = extractProductIds(html);

  console.log(`  Found: ${aliases.length} alias(es), ${productIds.length} product(s)`);

  return {
    name: actressName,
    aliases,
    productIds,
  };
}

/**
 * データベースに保存
 */
async function saveActressData(db: any, performerId: number, data: ActressData): Promise<{ aliases: number; products: number }> {
  const result = { aliases: 0, products: 0 };

  // 別名を保存
  for (const alias of data.aliases) {
    if (!alias || alias === data.name) continue;
    try {
      await db.insert(performerAliases).values({
        performerId,
        aliasName: alias,
        source: 'wikipedia-ja',
        isPrimary: false,
      }).onConflictDoNothing();
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
      const existingProduct = await db.select()
        .from(products)
        .where(eq(products.normalizedProductId, normalizedCode))
        .limit(1);

      if (existingProduct.length > 0) {
        await db.insert(productPerformers).values({
          productId: existingProduct[0].id,
          performerId,
        }).onConflictDoNothing();
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
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 100;

  console.log('=== Wikipedia日本語版 Crawler (別名・作品紐付け) ===\n');
  console.log(`Limit: ${limit} actresses\n`);

  // まだWikipediaからデータを取得していない女優を優先的に処理
  // 作品紐付けが多い（人気のある）女優から処理
  const actressesToProcess = await db.execute(sql`
    SELECT p.id, p.name
    FROM performers p
    LEFT JOIN performer_aliases pa ON p.id = pa.performer_id AND pa.source = 'wikipedia-ja'
    WHERE pa.id IS NULL
    AND LENGTH(p.name) > 1
    ORDER BY (
      SELECT COUNT(*) FROM product_performers pp WHERE pp.performer_id = p.id
    ) DESC
    LIMIT ${limit}
  `);

  console.log(`Found ${actressesToProcess.rows.length} actresses to process\n`);

  let successCount = 0;
  let failCount = 0;
  let totalAliases = 0;
  let totalProducts = 0;

  for (const actress of actressesToProcess.rows as any[]) {
    console.log(`\n[${successCount + failCount + 1}/${actressesToProcess.rows.length}] Processing: ${actress.name}`);

    const data = await fetchActressPage(actress.name);

    if (data) {
      const result = await saveActressData(db, actress.id, data);
      totalAliases += result.aliases;
      totalProducts += result.products;

      if (result.aliases > 0 || result.products > 0) {
        console.log(`  Saved: ${result.aliases} alias(es), ${result.products} product(s)`);
      }
      successCount++;
    } else {
      failCount++;

      // Wikipediaに記事がない場合でも、処理済みマークをつける（空のエイリアスを挿入）
      // ただし、これは再処理を防ぐためのもので、実際のデータは保存しない
    }

    // Rate limiting: 1秒待機（WikipediaのAPI利用規約に従う）
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n=== Summary ===');
  console.log(`Processed: ${successCount + failCount}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Aliases added: ${totalAliases}`);
  console.log(`Products linked: ${totalProducts}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
