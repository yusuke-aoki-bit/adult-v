/**
 * DTI商品に出演者を紐付けるバックフィルスクリプト
 *
 * 一本道: JSON APIから出演者情報を取得
 * 他サイト: HTMLから出演者情報をパース
 */

import { getDb } from '../../lib/db';
import { performers, productPerformers } from '../../lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import iconv from 'iconv-lite';

const db = getDb();

// サイト名（日本語）からURLパターンへのマッピング
const DTI_SITES: Record<string, {
  siteKey: string;
  apiUrl?: string;
  htmlUrl?: string;
  actorPattern?: RegExp;
}> = {
  '一本道': {
    siteKey: '1pondo',
    apiUrl: 'https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/{id}.json',
  },
  'カリビアンコム': {
    siteKey: 'caribbeancom',
    htmlUrl: 'https://www.caribbeancom.com/moviepages/{id}/index.html',
    // HTMLの構造: <span class="spec-title">出演</span>\n<span class="spec-content">\n<a class="spec-item" href="...">女優名</a>
    actorPattern: /<span class="spec-title">出演:?<\/span>[\s\S]*?<span class="spec-content">([\s\S]*?)<\/span>/,
  },
  'カリビアンコムプレミアム': {
    siteKey: 'caribbeancompr',
    htmlUrl: 'https://www.caribbeancompr.com/moviepages/{id}/index.html',
    actorPattern: /<span class="spec-title">出演:?<\/span>[\s\S]*?<span class="spec-content">([\s\S]*?)<\/span>/,
  },
  'パコパコママ': {
    siteKey: 'pacopacomama',
    htmlUrl: 'https://www.pacopacomama.com/moviepages/{id}/index.html',
    actorPattern: /<span class="spec-title">出演:?<\/span>[\s\S]*?<span class="spec-content">([\s\S]*?)<\/span>/,
  },
  '天然むすめ': {
    siteKey: '10musume',
    htmlUrl: 'https://www.10musume.com/moviepages/{id}/index.html',
    actorPattern: /<span class="spec-title">出演:?<\/span>[\s\S]*?<span class="spec-content">([\s\S]*?)<\/span>/,
  },
  'HEYZO': {
    siteKey: 'heyzo',
    htmlUrl: 'https://www.heyzo.com/moviepages/{id}/index.html',
    // HEYZOはtable構造
    actorPattern: /<th[^>]*>出演<\/th>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/,
  },
};

// 無効な女優名のパターン
const INVALID_PATTERNS = [
  /^[0-9]+$/,
  /^[a-zA-Z0-9_-]+$/,
  /^素人/,
  /企画/,
  /^他$/,
  /^→/,
  /^[ぁ-ん]$/,
  /^[ァ-ヶ]$/,
  /^[一-龯]$/,
  /^-$/,
  /^---$/,
  /モデル/,
  /^N\/A$/i,
];

function isValidPerformerName(name: string): boolean {
  if (!name || name.length < 2) return false;
  if (name.length > 50) return false;
  if (name === '-' || name === '---' || name === 'N/A') return false;

  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(name)) return false;
  }

  return true;
}

function parseNormalizedProductId(normalizedId: string): { siteName: string; productId: string } | null {
  const match = normalizedId.match(/^(.+?)-(.+)$/);
  if (!match) return null;
  return {
    siteName: match[1],
    productId: match[2],
  };
}

async function findOrCreatePerformer(name: string): Promise<number | null> {
  try {
    let performer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });

    if (performer) {
      return performer.id;
    }

    const [newPerformer] = await db
      .insert(performers)
      .values({
        name: name,
        nameKana: null,
      })
      .returning();

    return newPerformer.id;
  } catch {
    const existingPerformer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });
    return existingPerformer?.id || null;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function fetch1pondoActors(productId: string): Promise<string[]> {
  try {
    const apiUrl = `https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/${productId}.json`;
    const response = await fetchWithTimeout(apiUrl, 10000);

    if (!response || !response.ok) return [];

    const data = await response.json();
    return data.ActressesJa || [];
  } catch {
    return [];
  }
}

async function fetchHtmlActors(url: string, pattern: RegExp): Promise<string[]> {
  try {
    const response = await fetchWithTimeout(url, 10000);

    if (!response || !response.ok) return [];

    const buffer = Buffer.from(await response.arrayBuffer());
    // DTIサイトはEUC-JPを使用
    const html = iconv.decode(buffer, 'EUC-JP');

    const match = html.match(pattern);
    if (match && match[1]) {
      const content = match[1];
      const actors: string[] = [];

      // <a>タグ内のテキストを抽出
      const anchorMatches = content.matchAll(/<a[^>]*>([^<]+)<\/a>/gi);
      for (const m of anchorMatches) {
        const name = m[1].trim();
        if (name.length > 0) {
          actors.push(name);
        }
      }

      // <a>タグがない場合は従来のカンマ/スペース分割
      if (actors.length === 0) {
        return content
          .replace(/<[^>]+>/g, '') // HTMLタグ除去
          .split(/[,、\s]+/)
          .map(name => name.trim())
          .filter(name => name.length > 0);
      }

      return actors;
    }

    return [];
  } catch {
    return [];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5000');
  const batch = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '100');

  console.log('=== DTI 出演者紐付けバックフィル ===\n');
  console.log(`Limit: ${limit}, Batch: ${batch}\n`);

  // 未紐付きDTI商品を取得
  console.log('🔍 未紐付き商品を検索中...\n');

  const unlinkedProducts = await db.execute(sql`
    SELECT
      ps.product_id,
      ps.original_product_id,
      p.normalized_product_id
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'DTI'
    AND pp.product_id IS NULL
    AND (
      p.normalized_product_id LIKE '一本道-%'
      OR p.normalized_product_id LIKE 'カリビアンコム-%'
      OR p.normalized_product_id LIKE 'カリビアンコムプレミアム-%'
      OR p.normalized_product_id LIKE 'パコパコママ-%'
      OR p.normalized_product_id LIKE '天然むすめ-%'
      OR p.normalized_product_id LIKE 'HEYZO-%'
    )
    ORDER BY ps.product_id DESC
    LIMIT ${limit}
  `);

  console.log(`✅ 未紐付き商品: ${unlinkedProducts.rows.length}件\n`);

  if (unlinkedProducts.rows.length === 0) {
    console.log('処理対象の商品がありません');
    process.exit(0);
  }

  let processed = 0;
  let newRelations = 0;
  let noActorFound = 0;
  let errors = 0;
  let skipped = 0;

  for (const row of unlinkedProducts.rows as any[]) {
    try {
      const normalizedId = row.normalized_product_id;
      const parsed = parseNormalizedProductId(normalizedId);

      if (!parsed) {
        skipped++;
        continue;
      }

      const { siteName, productId } = parsed;
      const siteConfig = DTI_SITES[siteName];

      if (!siteConfig) {
        skipped++;
        continue;
      }

      let actors: string[] = [];

      // サイト別に出演者情報を取得
      if (siteName === '一本道' && siteConfig.apiUrl) {
        actors = await fetch1pondoActors(productId);
      } else if (siteConfig.htmlUrl && siteConfig.actorPattern) {
        const url = siteConfig.htmlUrl.replace('{id}', productId);
        actors = await fetchHtmlActors(url, siteConfig.actorPattern);
      }

      if (actors.length === 0) {
        noActorFound++;
        continue;
      }

      // 有効な出演者名のみフィルタリング
      const validActors = actors.filter(name => isValidPerformerName(name));

      if (validActors.length === 0) {
        noActorFound++;
        continue;
      }

      // 出演者を紐付け
      for (const name of validActors) {
        const performerId = await findOrCreatePerformer(name);

        if (!performerId) {
          errors++;
          continue;
        }

        await db
          .insert(productPerformers)
          .values({
            productId: row.product_id,
            performerId: performerId,
          })
          .onConflictDoNothing();

        newRelations++;
      }

      processed++;

      if (processed % batch === 0) {
        console.log(`進捗: ${processed}/${unlinkedProducts.rows.length} (紐付け: ${newRelations}件, 出演者なし: ${noActorFound}件)`);
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      errors++;
      if (errors < 10) {
        console.error(`エラー (product_id: ${row.product_id}):`, error);
      }
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`処理済み: ${processed}件`);
  console.log(`新規紐付け: ${newRelations}件`);
  console.log(`出演者なし: ${noActorFound}件`);
  console.log(`スキップ: ${skipped}件`);
  console.log(`エラー: ${errors}件`);

  // 最終統計
  const stats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ps.product_id) as total,
      COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) as with_performer
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'DTI'
  `);

  console.log('\n=== DTI紐付け状況 ===');
  console.table(stats.rows);

  process.exit(0);
}

main().catch(console.error);
