/**
 * erodougazo.com メーカー別ページからG-AREA/Tokyo247の出演者データをクロール
 *
 * データ構造:
 * - メーカーページ: https://erodougazo.com/av/search/production__XXXX/
 * - 作品タイトル = 出演者名（大文字英語: MAYUMI, IKUKO など）
 *
 * 使用方法:
 *   npx tsx scripts/crawlers/crawl-erodougazo-performers.ts
 *   npx tsx scripts/crawlers/crawl-erodougazo-performers.ts --dry-run
 *   npx tsx scripts/crawlers/crawl-erodougazo-performers.ts --maker=tokyo247
 */

import * as cheerio from 'cheerio';
import { db } from '../../lib/db';
import { wikiPerformerIndex } from '../../lib/db/schema';
import { sql } from 'drizzle-orm';

// メーカー別プロダクションID と開始ページ
// 注: 最初の数ページはAIリマスター作品のため日本語タイトル、
//     古いページ（9ページ以降）にオリジナル作品（英語名タイトル）がある
interface MakerConfig {
  productionId: number;
  startPage: number; // 出演者名が英語のページ開始位置
}

const PRODUCTION_IDS: Record<string, MakerConfig> = {
  tokyo247: { productionId: 1296, startPage: 9 },
  // G-AREAのIDは後で追加（要調査）
};

interface PerformerEntry {
  makerName: string;
  performerName: string; // 英語名（MAYUMI等）
  productTitle: string;
  productUrl: string;
}

const RATE_LIMIT_MS = 1500;

/**
 * ページから出演者情報を抽出
 * メタディスクリプションから「MAYUMI / IKUKO / ...」形式で名前を取得
 */
async function fetchPerformersFromPage(
  makerName: string,
  productionId: number,
  page: number,
): Promise<PerformerEntry[]> {
  const url =
    page === 1
      ? `https://erodougazo.com/av/search/production__${productionId}/`
      : `https://erodougazo.com/av/search/production__${productionId}/page__${page}/`;

  console.log(`  Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) {
    if (response['status'] === 404) {
      return []; // ページ終了
    }
    throw new Error(`HTTP ${response['status']}`);
  }

  const html = await response['text']();
  const $ = cheerio.load(html);

  const performers: PerformerEntry[] = [];

  // メタディスクリプションから出演者名を抽出
  // 形式: "...全529件。MISORA / REIRA / EMIRU / MAIKA / YUMINA / KAHO / SACHI / ..."
  const metaDescription = $('meta[name="description"]').attr('content') || '';

  // "件。" の後にある名前リストを抽出
  const namesMatch = metaDescription.match(/件。(.+?)$/);
  if (namesMatch && namesMatch[1]) {
    const namesStr = namesMatch[1];
    // スラッシュ区切りで分割
    const names = namesStr
      .split(' / ')
      .map((n) => n.trim())
      .filter((n) => {
        // 英字（全大文字or先頭大文字）または日本語（ひらがな・カタカナ）の名前（2-15文字）をフィルタ
        return (
          n.length >= 2 &&
          n.length <= 15 &&
          (/^[A-Z]+$/.test(n) || /^[A-Z][a-z]+$/.test(n) || /^[\u3040-\u309F\u30A0-\u30FF]+$/.test(n))
        );
      });

    for (const name of names) {
      if (!performers.find((p) => p.performerName === name)) {
        performers.push({
          makerName,
          performerName: name,
          productTitle: name,
          productUrl: url,
        });
      }
    }
  }

  // 作品リストからも抽出（li.avl_av_item形式）
  $('li.avl_av_item a, li.avlist a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const title = $(el).attr('title') || $(el).text().trim();

    // 出演者名として妥当なものをフィルタ（英字またはひらがな・カタカナ 2-15文字）
    const isUpperEnglish = /^[A-Z]+$/.test(title); // MAYUMI
    const isCapitalizedEnglish = /^[A-Z][a-z]+$/.test(title); // Mayumi
    const isEnglishName = isUpperEnglish || isCapitalizedEnglish;
    const isJapaneseName = /^[\u3040-\u309F\u30A0-\u30FF]+$/.test(title);
    const normalizedName = isEnglishName ? title.toUpperCase() : title;
    if (
      title &&
      title.length >= 2 &&
      title.length <= 15 &&
      (isEnglishName || isJapaneseName) &&
      !performers.find((p) => p.performerName === normalizedName)
    ) {
      performers.push({
        makerName,
        performerName: normalizedName,
        productTitle: title,
        productUrl: href.startsWith('http') ? href : `https://erodougazo.com${href}`,
      });
    }
  });

  return performers;
}

/**
 * メーカーの全ページをクロール
 */
async function crawlMaker(makerName: string, config: MakerConfig, maxPages: number = 50): Promise<PerformerEntry[]> {
  console.log(
    `\n=== Crawling ${makerName} (production__${config.productionId}, starting from page ${config.startPage}) ===`,
  );

  const allPerformers: PerformerEntry[] = [];

  for (let page = config.startPage; page <= config.startPage + maxPages; page++) {
    try {
      const performers = await fetchPerformersFromPage(makerName, config.productionId, page);

      if (performers.length === 0) {
        console.log(`  Page ${page}: No more results, stopping`);
        break;
      }

      console.log(`  Page ${page}: Found ${performers.length} performers`);
      allPerformers.push(...performers);

      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    } catch (error) {
      console.error(`  Page ${page}: Error - ${error}`);
      break;
    }
  }

  return allPerformers;
}

/**
 * 英語名からひらがな/カタカナ名への変換候補を生成
 * 例: MAYUMI → まゆみ, マユミ
 */
function generateJapaneseVariants(englishName: string): string[] {
  // ローマ字→ひらがな変換マップ（基本的なもの）
  const romajiMap: Record<string, string> = {
    a: 'あ',
    i: 'い',
    u: 'う',
    e: 'え',
    o: 'お',
    ka: 'か',
    ki: 'き',
    ku: 'く',
    ke: 'け',
    ko: 'こ',
    sa: 'さ',
    si: 'し',
    shi: 'し',
    su: 'す',
    se: 'せ',
    so: 'そ',
    ta: 'た',
    ti: 'ち',
    chi: 'ち',
    tu: 'つ',
    tsu: 'つ',
    te: 'て',
    to: 'と',
    na: 'な',
    ni: 'に',
    nu: 'ぬ',
    ne: 'ね',
    no: 'の',
    ha: 'は',
    hi: 'ひ',
    hu: 'ふ',
    fu: 'ふ',
    he: 'へ',
    ho: 'ほ',
    ma: 'ま',
    mi: 'み',
    mu: 'む',
    me: 'め',
    mo: 'も',
    ya: 'や',
    yu: 'ゆ',
    yo: 'よ',
    ra: 'ら',
    ri: 'り',
    ru: 'る',
    re: 'れ',
    ro: 'ろ',
    wa: 'わ',
    wo: 'を',
    n: 'ん',
    ga: 'が',
    gi: 'ぎ',
    gu: 'ぐ',
    ge: 'げ',
    go: 'ご',
    za: 'ざ',
    zi: 'じ',
    ji: 'じ',
    zu: 'ず',
    ze: 'ぜ',
    zo: 'ぞ',
    da: 'だ',
    di: 'ぢ',
    du: 'づ',
    de: 'で',
    do: 'ど',
    ba: 'ば',
    bi: 'び',
    bu: 'ぶ',
    be: 'べ',
    bo: 'ぼ',
    pa: 'ぱ',
    pi: 'ぴ',
    pu: 'ぷ',
    pe: 'ぺ',
    po: 'ぽ',
    kya: 'きゃ',
    kyu: 'きゅ',
    kyo: 'きょ',
    sha: 'しゃ',
    shu: 'しゅ',
    sho: 'しょ',
    cha: 'ちゃ',
    chu: 'ちゅ',
    cho: 'ちょ',
    nya: 'にゃ',
    nyu: 'にゅ',
    nyo: 'にょ',
    hya: 'ひゃ',
    hyu: 'ひゅ',
    hyo: 'ひょ',
    mya: 'みゃ',
    myu: 'みゅ',
    myo: 'みょ',
    rya: 'りゃ',
    ryu: 'りゅ',
    ryo: 'りょ',
  };

  const name = englishName.toLowerCase();
  let hiragana = '';
  let i = 0;

  while (i < name.length) {
    // 3文字、2文字、1文字の順で探す
    let found = false;
    for (const len of [3, 2, 1]) {
      const chunk = name.substring(i, i + len);
      if (romajiMap[chunk]) {
        hiragana += romajiMap[chunk];
        i += len;
        found = true;
        break;
      }
    }
    if (!found) {
      i++; // スキップ
    }
  }

  if (!hiragana) return [];

  // ひらがな→カタカナ変換
  const katakana = hiragana
    .split('')
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 0x3041 && code <= 0x3096) {
        return String.fromCharCode(code + 0x60);
      }
      return c;
    })
    .join('');

  return [hiragana, katakana].filter((s) => s.length >= 2);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const makerArg = args.find((a) => a.startsWith('--maker='));
  const targetMaker = makerArg ? makerArg.split('=')[1] : null;

  console.log('=== erodougazo.com 出演者クローラー ===');
  console.log(`Dry run: ${dryRun}`);
  console.log(`Target maker: ${targetMaker || 'all'}`);

  const allPerformers: PerformerEntry[] = [];

  for (const [makerName, config] of Object.entries(PRODUCTION_IDS)) {
    if (targetMaker && makerName !== targetMaker) continue;

    const performers = await crawlMaker(makerName, config);
    allPerformers.push(...performers);
  }

  // 重複を除去（出演者名でユニーク化）
  const uniquePerformers = new Map<string, PerformerEntry>();
  for (const p of allPerformers) {
    const key = `${p.makerName}:${p.performerName}`;
    if (!uniquePerformers.has(key)) {
      uniquePerformers.set(key, p);
    }
  }

  console.log(`\n=== 結果 ===`);
  console.log(`Total unique performers: ${uniquePerformers.size}`);

  // 日本語名変換も表示
  console.log(`\n=== 出演者一覧（日本語名候補付き） ===`);
  for (const [, p] of uniquePerformers) {
    const japaneseNames = generateJapaneseVariants(p.performerName);
    console.log(`${p.makerName}: ${p.performerName} → ${japaneseNames.join(', ') || '変換不可'}`);
  }

  if (!dryRun) {
    console.log('\n=== DBに保存中 ===');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const [, p] of uniquePerformers) {
      const japaneseNames = generateJapaneseVariants(p.performerName);
      const isEnglishName = /^[A-Z]+$/.test(p.performerName);
      const firstJapaneseName = japaneseNames[0];
      const performerDisplayName =
        isEnglishName && firstJapaneseName
          ? firstJapaneseName // 日本語名がある場合はそちらを使用
          : p.performerName;

      try {
        await db
          .insert(wikiPerformerIndex)
          .values({
            productTitle: p.productTitle,
            maker: p.makerName,
            performerName: performerDisplayName,
            performerNameRomaji: isEnglishName ? p.performerName : null,
            performerNameVariants: japaneseNames.length > 0 ? japaneseNames : null,
            source: 'erodougazo',
            sourceUrl: p.productUrl,
            confidence: 100,
          })
          .onConflictDoNothing();

        insertedCount++;
      } catch (error) {
        console.error(`  Error saving ${p.performerName}:`, error);
        skippedCount++;
      }
    }

    console.log(`Inserted: ${insertedCount}, Skipped: ${skippedCount}`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
