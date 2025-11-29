/**
 * rawデータ解析スクリプト
 *
 * 機能:
 * - raw_html_dataテーブルから未処理データを解析
 * - HTMLから商品情報を抽出してproductsテーブルに新規登録
 * - 画像、出演者情報も同時に抽出・登録
 * - 処理済みフラグを更新
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/process-raw-data.ts [--limit 1000] [--source MGS]
 */

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const db = getDb();

interface ParsedProduct {
  title?: string;
  description?: string;
  performers: string[];
  images: string[];
  thumbnailUrl?: string;
  duration?: number;
  releaseDate?: string;
  price?: number;
  maker?: string;
  label?: string;
  series?: string;
  genres?: string[];
}

interface ProcessStats {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  imagesExtracted: number;
  performersExtracted: number;
}

/**
 * MGSのHTMLから商品情報を抽出
 */
function parseMgsHtml(html: string, productId: string): ParsedProduct {
  const $ = cheerio.load(html);
  const performers: string[] = [];
  const images: string[] = [];
  const genres: string[] = [];

  // タイトル
  const title = $('h1.tag').text().trim() || $('title').text().split('|')[0].trim();

  // 説明
  const description = $('p.txt.introduction').text().trim();

  // サムネイル
  const thumbnailUrl = $('img.package_img').attr('src') ||
                       $('meta[property="og:image"]').attr('content');

  // 出演者
  $('a[href*="/search/cSearch.php?actress_id="]').each((_, el) => {
    const name = $(el).text().trim();
    if (name && name.length > 1 && name.length < 30) {
      performers.push(name);
    }
  });

  // サンプル画像
  $('a.sample_image img, img.sample_img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src && !images.includes(src) && src.includes('mgstage.com')) {
      images.push(src);
    }
  });

  // ジャンル
  $('a[href*="/search/cSearch.php?genre="]').each((_, el) => {
    const genre = $(el).text().trim();
    if (genre && genre.length > 0) {
      genres.push(genre);
    }
  });

  // 再生時間
  let duration: number | undefined;
  const durationMatch = html.match(/(\d+)分/);
  if (durationMatch) {
    duration = parseInt(durationMatch[1]);
  }

  // メーカー
  const maker = $('a[href*="/search/cSearch.php?maker_id="]').first().text().trim();

  return { title, description, performers, images, thumbnailUrl, duration, maker, genres };
}

/**
 * DUGAのHTMLから商品情報を抽出
 */
function parseDugaHtml(html: string, productId: string): ParsedProduct {
  const $ = cheerio.load(html);
  const performers: string[] = [];
  const images: string[] = [];
  const genres: string[] = [];

  const title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
  const description = $('.item-description, .description').text().trim();

  // サムネイル
  const thumbnailUrl = $('img.package, .package img').attr('src') ||
                       $('meta[property="og:image"]').attr('content');

  // 出演者
  $('a[href*="/actress/"], a[href*="actress_id"]').each((_, el) => {
    const name = $(el).text().trim();
    if (name && name.length > 1 && name.length < 30 && !name.includes('一覧')) {
      performers.push(name);
    }
  });

  // 画像
  $('img[src*="pics.dmm.co.jp"], img[src*="duga.jp"]').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !images.includes(src)) {
      images.push(src);
    }
  });

  // ジャンル
  $('a[href*="/genre/"], a[href*="genre_id"]').each((_, el) => {
    const genre = $(el).text().trim();
    if (genre && genre.length > 0 && !genre.includes('一覧')) {
      genres.push(genre);
    }
  });

  // メーカー
  const maker = $('a[href*="/maker/"]').first().text().trim();

  return { title, description, performers, images, thumbnailUrl, maker, genres };
}

/**
 * 一本道のHTMLから商品情報を抽出
 */
function parse1pondoHtml(html: string, productId: string): ParsedProduct {
  const $ = cheerio.load(html);
  const performers: string[] = [];
  const images: string[] = [];

  // タイトル - metaタグから
  let title = $('meta[property="og:title"]').attr('content') ||
              $('title').text().split('|')[0].trim();

  // サイト名サフィックスを削除
  title = title?.replace(/\s*\|\s*一本道.*$/, '').trim();

  const description = $('meta[name="description"]').attr('content') || '';

  // サムネイル
  const thumbnailUrl = $('meta[property="og:image"]').attr('content');

  // 出演者 - JSON-LDやページ内から
  const actressMatch = html.match(/"actress":\s*\["([^"]+)"\]/);
  if (actressMatch) {
    performers.push(...actressMatch[1].split(',').map(s => s.trim()));
  }

  return { title, description, performers, images, thumbnailUrl };
}

/**
 * カリビアンコムのHTMLから商品情報を抽出
 */
function parseCaribbeanHtml(html: string, productId: string): ParsedProduct {
  const $ = cheerio.load(html);
  const performers: string[] = [];
  const images: string[] = [];

  let title = $('meta[property="og:title"]').attr('content') ||
              $('title').text().trim();

  // サイト名サフィックスを削除
  title = title?.replace(/\s*\|\s*カリビアンコム.*$/, '').trim();

  const description = $('meta[name="description"]').attr('content') || '';
  const thumbnailUrl = $('meta[property="og:image"]').attr('content');

  // 出演者
  $('a[href*="/search_act/"]').each((_, el) => {
    const name = $(el).text().trim();
    if (name && name.length > 1 && name.length < 30) {
      performers.push(name);
    }
  });

  return { title, description, performers, images, thumbnailUrl };
}

/**
 * アフィリエイトURLを生成
 */
function generateAffiliateUrl(source: string, productId: string, url?: string): string {
  switch (source) {
    case 'MGS':
      return `https://www.mgstage.com/product/product_detail/${productId}/?af=gachi`;
    case 'DUGA':
      return `https://duga.jp/ppv/${productId}/?ref=48611`;
    case '一本道':
      return `https://www.1pondo.tv/movies/${productId}/?utm_source=affiliate`;
    case 'カリビアンコム':
      return `https://www.caribbeancom.com/moviepages/${productId}/index.html?aff=affiliate`;
    case 'カリビアンコムプレミアム':
      return `https://www.caribbeancompr.com/moviepages/${productId}/index.html?aff=affiliate`;
    case 'HEYZO':
      return `https://www.heyzo.com/moviepages/${productId}/index.html?aff=affiliate`;
    default:
      return url || '';
  }
}

/**
 * rawデータを処理して商品を作成
 */
async function processRawData(limit: number, sourceFilter?: string) {
  const stats: ProcessStats = {
    total: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    imagesExtracted: 0,
    performersExtracted: 0,
  };

  console.log('=== rawデータ解析（商品作成モード） ===\n');
  console.log(`設定: limit=${limit}, source=${sourceFilter || 'all'}\n`);

  // 未処理のrawデータを取得
  let query;
  if (sourceFilter) {
    query = sql`
      SELECT id, source, product_id, html_content, url
      FROM raw_html_data
      WHERE processed_at IS NULL AND source = ${sourceFilter}
      ORDER BY crawled_at DESC
      LIMIT ${limit}
    `;
  } else {
    query = sql`
      SELECT id, source, product_id, html_content, url
      FROM raw_html_data
      WHERE processed_at IS NULL
      ORDER BY crawled_at DESC
      LIMIT ${limit}
    `;
  }

  const rawRecords = await db.execute(query);
  stats.total = rawRecords.rows.length;

  console.log(`未処理レコード: ${stats.total}件\n`);

  for (const record of rawRecords.rows) {
    const { id, source, product_id, html_content, url } = record as any;

    try {
      // 既存チェック
      const existingCheck = await db.execute(sql`
        SELECT p.id FROM products p
        JOIN product_sources ps ON p.id = ps.product_id
        WHERE ps.original_product_id = ${product_id} AND ps.asp_name = ${source}
        LIMIT 1
      `);

      if (existingCheck.rows.length > 0) {
        // 既存商品があれば処理済みにして次へ
        await db.execute(sql`
          UPDATE raw_html_data SET processed_at = NOW() WHERE id = ${id}
        `);
        stats.skipped++;
        continue;
      }

      // ソース別にパース
      let parsed: ParsedProduct;
      switch (source) {
        case 'MGS':
          parsed = parseMgsHtml(html_content, product_id);
          break;
        case 'DUGA':
          parsed = parseDugaHtml(html_content, product_id);
          break;
        case '一本道':
          parsed = parse1pondoHtml(html_content, product_id);
          break;
        case 'カリビアンコム':
        case 'カリビアンコムプレミアム':
          parsed = parseCaribbeanHtml(html_content, product_id);
          break;
        default:
          // 汎用パーサー
          const $ = cheerio.load(html_content);
          parsed = {
            title: $('title').text().trim(),
            description: $('meta[name="description"]').attr('content') || '',
            performers: [],
            images: [],
            thumbnailUrl: $('meta[property="og:image"]').attr('content'),
          };
      }

      // タイトルがない場合はスキップ
      if (!parsed.title || parsed.title.length < 3) {
        console.log(`  ⏭️ タイトルなし: ${source}/${product_id}`);
        await db.execute(sql`
          UPDATE raw_html_data SET processed_at = NOW() WHERE id = ${id}
        `);
        stats.skipped++;
        continue;
      }

      // アフィリエイトURL生成
      const affiliateUrl = generateAffiliateUrl(source, product_id, url);

      // 商品作成
      const productResult = await db.execute(sql`
        INSERT INTO products (title, description, thumbnail_url, duration, release_date)
        VALUES (${parsed.title}, ${parsed.description || null}, ${parsed.thumbnailUrl || null}, ${parsed.duration || null}, ${parsed.releaseDate || null})
        RETURNING id
      `);

      const newProductId = (productResult.rows[0] as any).id;

      // product_sources 登録
      await db.execute(sql`
        INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url)
        VALUES (${newProductId}, ${source}, ${product_id}, ${affiliateUrl})
        ON CONFLICT (product_id, asp_name) DO NOTHING
      `);

      // 画像を保存
      if (parsed.thumbnailUrl) {
        await db.execute(sql`
          INSERT INTO product_images (product_id, image_url, image_type, display_order, asp_name)
          VALUES (${newProductId}, ${parsed.thumbnailUrl}, 'thumbnail', 0, ${source})
          ON CONFLICT (product_id, image_url) DO NOTHING
        `);
        stats.imagesExtracted++;
      }

      for (let i = 0; i < parsed.images.length; i++) {
        try {
          await db.execute(sql`
            INSERT INTO product_images (product_id, image_url, image_type, display_order, asp_name)
            VALUES (${newProductId}, ${parsed.images[i]}, 'sample', ${i + 1}, ${source})
            ON CONFLICT (product_id, image_url) DO NOTHING
          `);
          stats.imagesExtracted++;
        } catch (e) {
          // 重複は無視
        }
      }

      // 出演者を保存
      for (const performerName of parsed.performers) {
        try {
          const performerResult = await db.execute(sql`
            INSERT INTO performers (name)
            VALUES (${performerName})
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `);

          const performerId = (performerResult.rows[0] as any).id;

          await db.execute(sql`
            INSERT INTO product_performers (product_id, performer_id)
            VALUES (${newProductId}, ${performerId})
            ON CONFLICT DO NOTHING
          `);
          stats.performersExtracted++;
        } catch (e) {
          // エラーは無視
        }
      }

      // 処理済みフラグを更新
      await db.execute(sql`
        UPDATE raw_html_data SET processed_at = NOW() WHERE id = ${id}
      `);

      stats.created++;

      if (stats.created % 100 === 0) {
        console.log(`進捗: ${stats.created}件作成 / ${stats.total}件中`);
      }

    } catch (error) {
      console.error(`  ❌ エラー (${source}/${product_id}): ${error}`);
      stats.errors++;
    }
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);

  let limit = 1000;
  let sourceFilter: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === '--source' && args[i + 1]) {
      sourceFilter = args[i + 1];
    }
  }

  const stats = await processRawData(limit, sourceFilter);

  console.log('\n=== 処理完了 ===\n');
  console.table(stats);

  // 最終統計
  const finalStats = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as total,
      COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed,
      COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as unprocessed
    FROM raw_html_data
    GROUP BY source
    ORDER BY total DESC
  `);

  console.log('\nソース別処理状況:');
  console.table(finalStats.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
