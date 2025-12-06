/**
 * DTI系サイト（カリビアンコム、一本道、HEYZO等）の女優情報をFC2ブログから収集
 *
 * ソース: http://mankowomiseruavzyoyu.blog.fc2.com/
 *
 * 使用方法:
 *   npx tsx scripts/crawlers/crawl-dti-fc2blog.ts [limit]
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db/index.js';
import { sql } from 'drizzle-orm';
import { isValidPerformerName } from '../../lib/performer-validation.js';

const db = getDb();
const BASE_URL = 'http://mankowomiseruavzyoyu.blog.fc2.com';

// 五十音別インデックスページ
const INDEX_PAGES = [
  '/blog-entry-578.html',    // あ行
  '/blog-entry-2016.html',   // い～お行
  '/blog-entry-577.html',    // か～こ行
  '/blog-entry-576.html',    // さ～そ行
  '/blog-entry-2125.html',   // た～と行
  '/blog-entry-574.html',    // な～の行
  '/blog-entry-573.html',    // は～ほ行
  '/blog-entry-572.html',    // ま～も行
  '/blog-entry-571.html',    // や～よ行
  '/blog-entry-570.html',    // ら～わ行
];

// サイト別の品番パターン
const PRODUCT_CODE_PATTERNS: { [key: string]: RegExp } = {
  'カリビアンコム': /moviepages\/(\d{6}-\d{3})\/index\.html/,
  'カリビアンコムプレミアム': /moviepages\/(\d{6}_\d{3})\/index\.html/,
  '一本道': /movies\/(\d{6}_\d{3})\/?/,
  'HEYZO': /moviepages\/(\d{4})\/index\.html/,
};

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) {
      console.log(`  ✗ HTTP ${response.status} for ${url}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`  ✗ Error fetching ${url}:`, error);
    return null;
  }
}

async function saveToWikiCrawlData(
  source: string,
  productCode: string,
  performerName: string,
  sourceUrl: string
): Promise<boolean> {
  if (!isValidPerformerName(performerName)) return false;

  try {
    await db.execute(sql`
      INSERT INTO wiki_crawl_data (source, product_code, performer_name, source_url)
      VALUES (${source}, ${productCode}, ${performerName}, ${sourceUrl})
      ON CONFLICT (source, product_code, performer_name) DO NOTHING
    `);
    return true;
  } catch {
    return false;
  }
}

interface ActressData {
  name: string;
  aliases: string[];
  products: Array<{
    site: string;
    code: string;
    title: string;
    url: string;
  }>;
}

function extractActressPageUrls($: cheerio.CheerioAPI): string[] {
  const urls: string[] = [];

  // インデックスページから女優個別ページへのリンクを抽出
  $('a[href*="blog-entry-"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href && !INDEX_PAGES.some(idx => href.includes(idx))) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
      if (!urls.includes(fullUrl) && fullUrl.includes('blog-entry-')) {
        urls.push(fullUrl);
      }
    }
  });

  return urls;
}

function extractActressData($: cheerio.CheerioAPI, url: string): ActressData | null {
  // タイトルから女優名と別名を抽出
  // 形式: 大咲萌（砂川梨那／江口亮子／みな／尾崎萌／鈴田明海）【...】
  const title = $('h2.ently_title a').first().text().trim();
  if (!title) return null;

  const nameMatch = title.match(/^([^（(【]+)/);
  if (!nameMatch) return null;

  const mainName = nameMatch[1].trim();
  const aliases: string[] = [];

  // 別名を抽出（括弧内）
  const aliasMatch = title.match(/[（(]([^）)]+)[）)]/);
  if (aliasMatch) {
    const aliasStr = aliasMatch[1];
    aliasStr.split(/[／\/、,]/).forEach(alias => {
      const trimmed = alias.trim();
      if (trimmed && trimmed !== mainName) {
        aliases.push(trimmed);
      }
    });
  }

  // 作品情報を抽出
  const products: ActressData['products'] = [];
  let currentSite = '';

  // テーブル内の配信サイトと作品を抽出
  $('table tr').each((_, row) => {
    const $row = $(row);
    const text = $row.text();

    // 配信サイト名を検出
    if (text.includes('配信サイト：')) {
      if (text.includes('カリビアンコムプレミアム')) {
        currentSite = 'カリビアンコムプレミアム';
      } else if (text.includes('カリビアンコム')) {
        currentSite = 'カリビアンコム';
      } else if (text.includes('一本道')) {
        currentSite = '一本道';
      } else if (text.includes('HEYZO')) {
        currentSite = 'HEYZO';
      }
      return;
    }

    // 作品リンクを抽出
    $row.find('a[href*="clear-tv.com"]').each((_, link) => {
      const href = $(link).attr('href') || '';
      const linkTitle = $(link).text().trim();

      if (!currentSite || !href) return;

      // 品番を抽出
      const pattern = PRODUCT_CODE_PATTERNS[currentSite];
      if (pattern) {
        const match = href.match(pattern);
        if (match) {
          let code = match[1];

          // HEYZO形式を正規化
          if (currentSite === 'HEYZO') {
            code = `HEYZO-${code.padStart(4, '0')}`;
          }

          // カリビアンコム/一本道形式を正規化（ハイフンをアンダースコアに統一）
          if (currentSite === 'カリビアンコム' || currentSite === 'カリビアンコムプレミアム') {
            code = code.replace('-', '_');
          }

          if (!products.some(p => p.code === code && p.site === currentSite)) {
            products.push({
              site: currentSite,
              code,
              title: linkTitle,
              url: href,
            });
          }
        }
      }
    });
  });

  if (products.length === 0) return null;

  return {
    name: mainName,
    aliases,
    products,
  };
}

async function crawlIndexPage(indexUrl: string): Promise<string[]> {
  console.log(`\n📋 Fetching index page: ${indexUrl}`);

  const html = await fetchHtml(indexUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const actressUrls = extractActressPageUrls($);

  console.log(`  Found ${actressUrls.length} actress pages`);
  return actressUrls;
}

async function crawlActressPage(url: string): Promise<number> {
  const html = await fetchHtml(url);
  if (!html) return 0;

  const $ = cheerio.load(html);
  const data = extractActressData($, url);

  if (!data) {
    return 0;
  }

  let saved = 0;
  const allNames = [data.name, ...data.aliases];

  for (const product of data.products) {
    // 主名と別名全てを関連付け
    for (const name of allNames) {
      if (await saveToWikiCrawlData('dti-fc2blog', product.code, name, url)) {
        saved++;
      }
    }
  }

  if (saved > 0) {
    console.log(`  ✅ ${data.name}: ${data.products.length} products, ${allNames.length} names, ${saved} saved`);
  }

  return saved;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0], 10) || 99999;

  console.log('🚀 Starting DTI FC2 Blog crawler');
  console.log(`   Source: ${BASE_URL}`);
  console.log(`   Limit: ${limit} pages\n`);

  // 全インデックスページから女優ページURLを収集
  const allActressUrls: string[] = [];

  for (const indexPath of INDEX_PAGES) {
    const urls = await crawlIndexPage(`${BASE_URL}${indexPath}`);
    for (const url of urls) {
      if (!allActressUrls.includes(url)) {
        allActressUrls.push(url);
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 Total unique actress pages: ${allActressUrls.length}`);

  // 各女優ページをクロール
  let processed = 0;
  let totalSaved = 0;

  for (const url of allActressUrls.slice(0, limit)) {
    console.log(`[${processed + 1}/${Math.min(allActressUrls.length, limit)}] ${url}`);

    const saved = await crawlActressPage(url);
    totalSaved += saved;
    processed++;

    if (processed % 50 === 0) {
      console.log(`\n📊 Progress: ${processed} pages, ${totalSaved} records saved\n`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n✅ Crawl complete!`);
  console.log(`   Pages processed: ${processed}`);
  console.log(`   Records saved: ${totalSaved}`);

  process.exit(0);
}

main().catch(console.error);
