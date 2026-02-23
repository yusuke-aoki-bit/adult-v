/**
 * 統合女優情報クローラー
 * 複数のソースから女優の別名・プロフィール・作品紐付け情報を収集
 *
 * 対応ソース:
 * - Wikipedia日本語版 (MediaWiki API)
 * - av-wiki.net (HTMLスクレイピング)
 *
 * 使用方法:
 * npx tsx scripts/crawlers/crawl-performer-info.ts --limit=100
 * npx tsx scripts/crawlers/crawl-performer-info.ts --source=wikipedia --limit=50
 * npx tsx scripts/crawlers/crawl-performer-info.ts --name="青木りん"
 */

import * as cheerio from 'cheerio';
import { getDb } from './lib/db';
import { performers, performerAliases, products, productPerformers } from './lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';

// ソースタイプ
type WikiSource = 'wikipedia-ja' | 'av-wiki-net';

interface ActressData {
  name: string;
  aliases: string[];
  productIds: string[]; // 品番リスト
  profile?: {
    height?: number;
    bust?: number;
    waist?: number;
    hip?: number;
    cup?: string;
    birthday?: string;
    birthplace?: string;
    bloodType?: string;
    hobbies?: string;
    debutYear?: number;
  };
}

interface CrawlResult {
  source: WikiSource;
  performerId: number;
  aliasesAdded: number;
  productsLinked: number;
  profileUpdated: boolean;
}

const DELAY_MS = 1500; // APIリクエスト間隔

// ========== Wikipedia日本語版 ==========

const WIKI_API_URL = 'https://ja.wikipedia.org/w/api.php';

async function fetchWikipediaPage(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    format: 'json',
    prop: 'text',
    redirects: '1',
  });

  try {
    const response = await fetch(`${WIKI_API_URL}?${params}`, {
      headers: {
        'User-Agent': 'AdultViewerLab/1.0 (Actress info crawler)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.error) return null;

    return data.parse?.text?.['*'] || null;
  } catch {
    return null;
  }
}

function extractAliasesFromWikipedia(html: string, actressName: string): string[] {
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
      header.includes('別名義') ||
      header.includes('愛称')
    ) {
      const tdHtml = $td.html() || '';
      const normalizedText = tdHtml.replace(/<br\s*\/?>/gi, '\n');
      const $temp = cheerio.load(`<div>${normalizedText}</div>`);
      const textContent = $temp('div').text();

      const parts = textContent
        .split(/[,、/／\n]/)
        .map((a) =>
          a
            .replace(/（[^）]*）/g, '')
            .replace(/\([^)]*\)/g, '')
            .trim(),
        )
        .filter((a) => {
          return (
            a.length >= 2 &&
            a.length < 20 &&
            a !== actressName &&
            !a.includes('など') &&
            !a.includes('→') &&
            !a.includes('の')
          );
        });

      aliases.push(...parts);
    }
  });

  // ページ冒頭の括弧内の別名も抽出
  const leadText = $('div.mw-parser-output > p').first().text();
  const namePatterns = [/旧芸名[：:]\s*([^、,。）]+)/g, /別名[：:]\s*([^、,。）]+)/g, /旧名[：:]\s*([^、,。）]+)/g];

  for (const pattern of namePatterns) {
    let match;
    while ((match = pattern.exec(leadText)) !== null) {
      const alias = match[1].trim();
      if (alias && alias !== actressName && alias.length < 20 && alias.length >= 2) {
        aliases.push(alias);
      }
    }
  }

  return [...new Set(aliases)];
}

function extractProfileFromWikipedia(html: string): ActressData['profile'] {
  const $ = cheerio.load(html);
  const profile: ActressData['profile'] = {};

  $('table.infobox tr').each((_, row) => {
    const $row = $(row);
    const header = $row.find('th').text().trim().toLowerCase();
    const value = $row.find('td').text().trim();

    if (!header || !value) return;

    // 身長
    if (header.includes('身長')) {
      const match = value.match(/(\d+)/);
      if (match) profile.height = parseInt(match[1]);
    }

    // スリーサイズ
    if (header.includes('スリーサイズ') || header.includes('身体サイズ')) {
      const match = value.match(/(\d+)\s*[-/]\s*(\d+)\s*[-/]\s*(\d+)/);
      if (match) {
        profile.bust = parseInt(match[1]);
        profile.waist = parseInt(match[2]);
        profile.hip = parseInt(match[3]);
      }
    }

    // カップ
    if (header.includes('カップ') || header.includes('バスト')) {
      const cupMatch = value.match(/([A-K])\s*カップ/i);
      if (cupMatch) profile.cup = cupMatch[1].toUpperCase();
    }

    // 生年月日
    if (header.includes('生年月日') || header.includes('誕生日')) {
      const dateMatch = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (dateMatch) {
        profile.birthday = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
    }

    // 出身地
    if (header.includes('出身地') || header.includes('出生地')) {
      profile.birthplace = value.substring(0, 50);
    }

    // 血液型
    if (header.includes('血液型')) {
      const bloodMatch = value.match(/([ABO]|AB)/i);
      if (bloodMatch) profile.bloodType = bloodMatch[1].toUpperCase();
    }

    // 趣味
    if (header.includes('趣味') || header.includes('特技')) {
      profile.hobbies = value.substring(0, 200);
    }
  });

  return Object.keys(profile).length > 0 ? profile : undefined;
}

function extractProductIdsFromWikipedia(html: string): string[] {
  const $ = cheerio.load(html);
  const foundProducts = new Set<string>();
  const productPattern = /\b([A-Z]{2,5}-\d{3,5})\b/g;

  const worksSections = ['作品', '出演作品', 'AV作品', 'アダルトビデオ', '映像作品'];
  let inWorksSection = false;

  $('h2, h3, table, ul, ol').each((_, elem) => {
    const $elem = $(elem);
    const tagName = elem.tagName.toLowerCase();

    if (tagName === 'h2' || tagName === 'h3') {
      const headlineText = $elem.find('.mw-headline').text().trim();
      inWorksSection = worksSections.some((s) => headlineText.includes(s));
    }

    if (inWorksSection && (tagName === 'table' || tagName === 'ul' || tagName === 'ol')) {
      const text = $elem.text();
      const matches = text.match(productPattern);
      if (matches) {
        matches.forEach((m) => foundProducts.add(m.toUpperCase()));
      }
    }
  });

  return Array.from(foundProducts);
}

async function fetchFromWikipedia(actressName: string): Promise<ActressData | null> {
  console.log(`  [Wikipedia] Fetching: ${actressName}`);

  const html = await fetchWikipediaPage(actressName);
  if (!html) {
    console.log(`  [Wikipedia] Not found`);
    return null;
  }

  const aliases = extractAliasesFromWikipedia(html, actressName);
  const profile = extractProfileFromWikipedia(html);
  const productIds = extractProductIdsFromWikipedia(html);

  console.log(`  [Wikipedia] Found: ${aliases.length} alias(es), ${productIds.length} product(s)`);

  return {
    name: actressName,
    aliases,
    productIds,
    profile,
  };
}

// ========== av-wiki.net ==========

async function fetchFromAvWikiNet(actressName: string): Promise<ActressData | null> {
  const encodedName = encodeURIComponent(actressName);
  const url = `https://av-wiki.net/?s=${encodedName}`;

  console.log(`  [av-wiki.net] Fetching: ${actressName}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.log(`  [av-wiki.net] HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 検索結果から名前が完全一致する記事を探す
    let actressPageUrl: string | null = null;
    $('article h2 a').each((_, elem) => {
      const title = $(elem).text().trim();
      if (title === actressName) {
        actressPageUrl = $(elem).attr('href') || null;
      }
    });

    if (!actressPageUrl) {
      console.log(`  [av-wiki.net] No exact match`);
      return null;
    }

    // 女優個別ページを取得
    const pageResponse = await fetch(actressPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!pageResponse.ok) return null;

    const pageHtml = await pageResponse.text();
    const $page = cheerio.load(pageHtml);

    const aliases: string[] = [];
    const productIds: string[] = [];

    // 別名を抽出
    $page('table tr, dl').each((_, elem) => {
      const text = $(elem).text();
      if (text.includes('別名') || text.includes('旧芸名')) {
        const valueMatch = text.match(/別名[：:]\s*(.+)|旧芸名[：:]\s*(.+)/);
        if (valueMatch) {
          const value = valueMatch[1] || valueMatch[2];
          const parts = value
            .split(/[,、/]/)
            .map((a) => a.trim())
            .filter((a) => a && a !== actressName);
          aliases.push(...parts);
        }
      }
    });

    // 品番を抽出
    const productPattern = /\b([A-Z]{2,5}-\d{3,5})\b/g;
    const fullText = $page('.entry-content').text();
    const matches = fullText.match(productPattern);
    if (matches) {
      matches.forEach((m) => productIds.push(m.toUpperCase()));
    }

    console.log(`  [av-wiki.net] Found: ${aliases.length} alias(es), ${productIds.length} product(s)`);

    return {
      name: actressName,
      aliases: [...new Set(aliases)],
      productIds: [...new Set(productIds)],
    };
  } catch (error) {
    console.log(`  [av-wiki.net] Error: ${error}`);
    return null;
  }
}

// ========== データ保存 ==========

async function saveActressData(
  db: ReturnType<typeof getDb>,
  performerId: number,
  data: ActressData,
  source: WikiSource,
): Promise<CrawlResult> {
  const result: CrawlResult = {
    source,
    performerId,
    aliasesAdded: 0,
    productsLinked: 0,
    profileUpdated: false,
  };

  // 別名を保存
  for (const alias of data.aliases) {
    if (!alias || alias === data.name || alias.length < 2) continue;
    try {
      await db
        .insert(performerAliases)
        .values({
          performerId,
          aliasName: alias,
          source,
          isPrimary: false,
        })
        .onConflictDoNothing();
      result.aliasesAdded++;
    } catch {
      // 重複は無視
    }
  }

  // 商品紐付け
  for (const productId of data.productIds) {
    try {
      const normalizedCode = productId.toLowerCase().replace(/[^a-z0-9]/g, '-');

      const existingProduct = await db
        .select()
        .from(products)
        .where(eq(products.normalizedProductId, normalizedCode))
        .limit(1);

      if (existingProduct.length > 0) {
        await db
          .insert(productPerformers)
          .values({
            productId: existingProduct[0].id,
            performerId,
          })
          .onConflictDoNothing();
        result.productsLinked++;
      }
    } catch {
      // 重複は無視
    }
  }

  // プロフィール更新
  if (data.profile && Object.keys(data.profile).length > 0) {
    try {
      const updateData: Record<string, any> = {};
      if (data.profile.height) updateData.height = data.profile.height;
      if (data.profile.bust) updateData.bust = data.profile.bust;
      if (data.profile.waist) updateData.waist = data.profile.waist;
      if (data.profile.hip) updateData.hip = data.profile.hip;
      if (data.profile.cup) updateData.cup = data.profile.cup;
      if (data.profile.birthday) updateData.birthday = new Date(data.profile.birthday);
      if (data.profile.birthplace) updateData.birthplace = data.profile.birthplace;
      if (data.profile.bloodType) updateData.bloodType = data.profile.bloodType;
      if (data.profile.hobbies) updateData.hobbies = data.profile.hobbies;
      if (data.profile.debutYear) updateData.debutYear = data.profile.debutYear;

      if (Object.keys(updateData).length > 0) {
        await db.update(performers).set(updateData).where(eq(performers.id, performerId));
        result.profileUpdated = true;
      }
    } catch (error) {
      console.error(`  Profile update error: ${error}`);
    }
  }

  return result;
}

// ========== メイン処理 ==========

async function main() {
  const db = getDb();
  const args = process.argv.slice(2);

  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;

  const sourceArg = args.find((a) => a.startsWith('--source='));
  const sourceFilter = sourceArg ? sourceArg.split('=')[1] : null;

  const nameArg = args.find((a) => a.startsWith('--name='));
  const specificName = nameArg ? nameArg.split('=')[1] : null;

  console.log('=== 統合女優情報クローラー ===\n');
  console.log(`Limit: ${limit}`);
  console.log(`Source filter: ${sourceFilter || 'all'}`);
  console.log(`Specific name: ${specificName || 'none'}\n`);

  let actressesToProcess: { id: number; name: string }[] = [];

  if (specificName) {
    // 特定の女優を検索
    const found = await db.select().from(performers).where(eq(performers.name, specificName)).limit(1);

    if (found.length > 0) {
      actressesToProcess = [{ id: found[0].id, name: found[0].name }];
    } else {
      console.log(`Actress not found: ${specificName}`);
      process.exit(1);
    }
  } else {
    // まだWikipediaからデータを取得していない女優を優先
    const result = await db.execute(sql`
      SELECT p.id, p.name
      FROM performers p
      LEFT JOIN performer_aliases pa ON p.id = pa.performer_id AND pa.source = 'wikipedia-ja'
      WHERE pa.id IS NULL
      AND LENGTH(p.name) >= 2
      AND p.name NOT LIKE '%(%'
      ORDER BY (
        SELECT COUNT(*) FROM product_performers pp WHERE pp.performer_id = p.id
      ) DESC
      LIMIT ${limit}
    `);

    actressesToProcess = result.rows.map((r: any) => ({ id: r.id, name: r.name }));
  }

  console.log(`Found ${actressesToProcess.length} actresses to process\n`);

  let totalAliases = 0;
  let totalProducts = 0;
  let totalProfiles = 0;
  let processed = 0;

  for (const actress of actressesToProcess) {
    console.log(`[${++processed}/${actressesToProcess.length}] ${actress.name} (ID: ${actress.id})`);

    // Wikipedia
    if (!sourceFilter || sourceFilter === 'wikipedia') {
      const wikiData = await fetchFromWikipedia(actress.name);
      if (wikiData) {
        const result = await saveActressData(db, actress.id, wikiData, 'wikipedia-ja');
        totalAliases += result.aliasesAdded;
        totalProducts += result.productsLinked;
        if (result.profileUpdated) totalProfiles++;
        console.log(
          `    Saved: +${result.aliasesAdded} aliases, +${result.productsLinked} products, profile: ${result.profileUpdated}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }

    // av-wiki.net (オプション)
    if (sourceFilter === 'av-wiki-net') {
      const avWikiData = await fetchFromAvWikiNet(actress.name);
      if (avWikiData) {
        const result = await saveActressData(db, actress.id, avWikiData, 'av-wiki-net');
        totalAliases += result.aliasesAdded;
        totalProducts += result.productsLinked;
        console.log(`    Saved: +${result.aliasesAdded} aliases, +${result.productsLinked} products`);
      }
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }

    console.log('');
  }

  console.log('\n=== Summary ===');
  console.log(`Processed: ${processed} actresses`);
  console.log(`Total aliases added: ${totalAliases}`);
  console.log(`Total products linked: ${totalProducts}`);
  console.log(`Profiles updated: ${totalProfiles}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
