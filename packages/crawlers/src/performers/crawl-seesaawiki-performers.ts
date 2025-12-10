/**
 * seesaawiki.jp/av_neme 素人AV女優名前特定wiki クローラー
 * 名前の分からないAV女優を特定するwikiサイトから出演者情報を取得
 * 主にS-Cute、ラグジュTV等に出演した女優の情報を収集
 */

import * as cheerio from 'cheerio';
import { db } from './lib/db';
import { wikiPerformerIndex } from './lib/db/schema';
import { sql } from 'drizzle-orm';
import * as iconv from 'iconv-lite';

const BASE_URL = 'https://seesaawiki.jp/av_neme';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DELAY_MS = 2000;

interface PerformerEntry {
  name: string;
  aliases: string[];
  maker: string | null;
  sourceUrl: string;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // EUC-JPエンコーディングをデコード
  const buffer = await response.arrayBuffer();
  const html = iconv.decode(Buffer.from(buffer), 'EUC-JP');
  return html;
}

/**
 * ページリストから全ページURLを取得
 */
async function getPageList(): Promise<string[]> {
  const pageListUrl = `${BASE_URL}/l/`;
  console.log(`Fetching page list from ${pageListUrl}`);

  const html = await fetchPage(pageListUrl);
  const $ = cheerio.load(html);

  const pageUrls: string[] = [];

  // ページリストからリンクを取得
  // /av_neme/d/xxx 形式のリンクを探す
  $('a[href*="/av_neme/d/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.includes('/edit') && !href.includes('/hist')) {
      const fullUrl = href.startsWith('http') ? href : `https://seesaawiki.jp${href}`;
      if (!pageUrls.includes(fullUrl)) {
        pageUrls.push(fullUrl);
      }
    }
  });

  return pageUrls;
}

/**
 * 個別ページから出演者情報を抽出
 */
async function parsePerformerPage(url: string): Promise<PerformerEntry | null> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    // ページタイトルから名前を取得
    const pageTitle = $('h2').first().text().trim().replace(/\s*編集する?\s*/g, '').trim();

    if (!pageTitle || pageTitle.length < 2 || pageTitle.length > 30) {
      return null;
    }

    // 日本語名として妥当かチェック
    if (!/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z]+$/.test(pageTitle)) {
      return null;
    }

    // トップページや特殊ページを除外
    const excludeWords = ['トップページ', 'メニュー', 'リンク', '一覧', 'ページ', '検索', '編集'];
    if (excludeWords.some(word => pageTitle.includes(word))) {
      return null;
    }

    const entry: PerformerEntry = {
      name: pageTitle,
      aliases: [],
      maker: null,
      sourceUrl: url,
    };

    // ページ本文からメーカー情報を抽出
    const bodyText = $('#page-body, .wiki-body, .page-body').text();

    // メーカー検出
    const makerPatterns = [
      { pattern: /S-Cute/i, maker: 's-cute' },
      { pattern: /ラグジュTV/i, maker: 'luxu-tv' },
      { pattern: /シロウトTV/i, maker: 'shiroto-tv' },
      { pattern: /ナンパTV/i, maker: 'nanpa-tv' },
      { pattern: /SIRO-/i, maker: 'siro' },
      { pattern: /G-AREA/i, maker: 'g-area' },
      { pattern: /Tokyo247/i, maker: 'tokyo247' },
      { pattern: /MGS動画/i, maker: 'mgs' },
      { pattern: /DMM/i, maker: 'dmm' },
    ];

    for (const { pattern, maker } of makerPatterns) {
      if (pattern.test(bodyText)) {
        entry.maker = maker;
        break;
      }
    }

    // 別名を抽出（「別名：」「旧名義：」等）
    const aliasPatterns = [
      /別名[：:]\s*([^\n、]+)/,
      /旧名義[：:]\s*([^\n、]+)/,
      /別名義[：:]\s*([^\n、]+)/,
    ];

    for (const pattern of aliasPatterns) {
      const match = bodyText.match(pattern);
      if (match && match[1]) {
        const alias = match[1].trim();
        if (alias.length >= 2 && alias.length <= 20 && !entry.aliases.includes(alias)) {
          entry.aliases.push(alias);
        }
      }
    }

    return entry;
  } catch (error) {
    console.error(`  Error parsing ${url}: ${error}`);
    return null;
  }
}

/**
 * 50音インデックスからページリストを取得
 */
async function getPageListByIndex(indexChar: string): Promise<string[]> {
  // URLエンコード（EUC-JP）
  const encodedChar = encodeURIComponent(indexChar);
  const url = `${BASE_URL}/l/?initial_mode=1&initial=${encodedChar}`;

  console.log(`  Fetching index: ${indexChar}`);

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const pageUrls: string[] = [];

    // ページリストからリンクを取得
    $('a[href*="/av_neme/d/"]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();

      if (href &&
          !href.includes('/edit') &&
          !href.includes('/hist') &&
          text.length >= 2 &&
          text.length <= 20) {
        const fullUrl = href.startsWith('http') ? href : `https://seesaawiki.jp${href}`;
        if (!pageUrls.includes(fullUrl)) {
          pageUrls.push(fullUrl);
        }
      }
    });

    return pageUrls;
  } catch (error) {
    console.error(`  Error fetching index ${indexChar}: ${error}`);
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;

  console.log('=== seesaawiki.jp/av_neme クローラー ===\n');
  console.log(`Dry run: ${dryRun}`);
  console.log(`Limit: ${limit}`);

  // 50音インデックスを使用してページを取得
  const hiragana = [
    'あ', 'い', 'う', 'え', 'お',
    'か', 'き', 'く', 'け', 'こ',
    'さ', 'し', 'す', 'せ', 'そ',
    'た', 'ち', 'つ', 'て', 'と',
    'な', 'に', 'ぬ', 'ね', 'の',
    'は', 'ひ', 'ふ', 'へ', 'ほ',
    'ま', 'み', 'む', 'め', 'も',
    'や', 'ゆ', 'よ',
    'ら', 'り', 'る', 'れ', 'ろ',
    'わ', 'を', 'ん',
  ];

  const allUrls: string[] = [];

  console.log('\nFetching page URLs from 50音 index...');

  for (const char of hiragana) {
    const urls = await getPageListByIndex(char);
    console.log(`  ${char}: ${urls.length} pages`);
    allUrls.push(...urls);

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nTotal pages found: ${allUrls.length}`);

  // 重複を除去
  const uniqueUrls = [...new Set(allUrls)];
  console.log(`Unique pages: ${uniqueUrls.length}`);

  // 既にクロール済みのURLをスキップ
  const existingUrls = await db
    .select({ sourceUrl: wikiPerformerIndex.sourceUrl })
    .from(wikiPerformerIndex)
    .where(sql`${wikiPerformerIndex.source} = 'seesaawiki'`);

  const crawledSet = new Set(existingUrls.map(r => r.sourceUrl));

  const urlsToCrawl = uniqueUrls
    .filter(url => !crawledSet.has(url))
    .slice(0, limit);

  console.log(`URLs to crawl: ${urlsToCrawl.length} (skipping ${uniqueUrls.length - urlsToCrawl.length} already crawled)`);

  if (urlsToCrawl.length === 0) {
    console.log('No new pages to crawl.');
    process.exit(0);
  }

  const performers: PerformerEntry[] = [];
  let crawled = 0;
  let errors = 0;

  for (const url of urlsToCrawl) {
    try {
      console.log(`\nCrawling: ${url}`);
      const performer = await parsePerformerPage(url);

      if (performer) {
        console.log(`  Found: ${performer.name} (maker: ${performer.maker || 'unknown'})`);
        performers.push(performer);
        crawled++;
      } else {
        console.log(`  Skipped (not a performer page)`);
      }

      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (error) {
      console.error(`  Error: ${error}`);
      errors++;
    }
  }

  console.log(`\n=== 結果 ===`);
  console.log(`Crawled: ${crawled}, Errors: ${errors}`);
  console.log(`Found performers: ${performers.length}`);

  if (!dryRun && performers.length > 0) {
    console.log('\n=== DBに保存中 ===');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const p of performers) {
      try {
        await db
          .insert(wikiPerformerIndex)
          .values({
            productTitle: null,
            maker: p.maker,
            performerName: p.name,
            performerNameRomaji: null,
            performerNameVariants: p.aliases.length > 0 ? p.aliases : null,
            source: 'seesaawiki',
            sourceUrl: p.sourceUrl,
            confidence: 80, // Wikiなので信頼度やや低め
          })
          .onConflictDoNothing();

        insertedCount++;
        console.log(`  Saved: ${p.name}`);
      } catch (error) {
        console.error(`  Error saving ${p.name}:`, error);
        skippedCount++;
      }
    }

    console.log(`\nInserted: ${insertedCount}, Skipped: ${skippedCount}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
