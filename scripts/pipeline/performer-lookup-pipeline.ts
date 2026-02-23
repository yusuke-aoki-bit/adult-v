/**
 * 演者名寄せ統合パイプライン
 *
 * 以下の3ステップを順序立てて実行:
 * 1. Wikiクローリング → wiki_crawl_data, product_performer_lookup テーブルに保存
 * 2. 名寄せ処理 → wiki_crawl_dataから商品-演者紐付けを作成
 * 3. 未紐付け商品のWeb検索 → 品番ベースでWikiサイトを検索
 *
 * 使用方法:
 *   npx tsx scripts/pipeline/performer-lookup-pipeline.ts [step] [options]
 *
 * ステップ:
 *   all       - 全ステップを順次実行（デフォルト）
 *   crawl     - Wikiクローリングのみ
 *   link      - wiki_crawl_dataからの紐付けのみ
 *   search    - 未紐付け商品のWeb検索のみ
 *   status    - 現在の統計情報を表示
 *
 * オプション:
 *   --asp=MGS       - 特定のASPのみ処理
 *   --limit=1000    - 処理件数上限
 *   --dry-run       - 実際の更新なし
 *   --source=seesaawiki,av-wiki  - クロール対象ソース
 */

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL環境変数が設定されていません');
  process.exit(1);
}

import { spawn, ChildProcess } from 'child_process';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface PipelineStats {
  totalProducts: number;
  productsWithPerformers: number;
  productsWithoutPerformers: number;
  wikiCrawlDataCount: number;
  lookupTableCount: number;
}

interface StepResult {
  success: boolean;
  duration: number;
  message: string;
}

/**
 * 現在の統計情報を取得
 */
async function getStats(): Promise<PipelineStats> {
  const client = await pool.connect();
  try {
    // 総商品数
    const totalResult = await client.query('SELECT COUNT(*) FROM products');
    const totalProducts = parseInt(totalResult.rows[0].count, 10);

    // 演者紐付け済み商品
    const linkedResult = await client.query('SELECT COUNT(DISTINCT product_id) FROM product_performers');
    const productsWithPerformers = parseInt(linkedResult.rows[0].count, 10);

    // wiki_crawl_data件数
    const wikiResult = await client.query('SELECT COUNT(*) FROM wiki_crawl_data');
    const wikiCrawlDataCount = parseInt(wikiResult.rows[0].count, 10);

    // product_performer_lookup件数
    const lookupResult = await client.query('SELECT COUNT(*) FROM product_performer_lookup');
    const lookupTableCount = parseInt(lookupResult.rows[0].count, 10);

    return {
      totalProducts,
      productsWithPerformers,
      productsWithoutPerformers: totalProducts - productsWithPerformers,
      wikiCrawlDataCount,
      lookupTableCount,
    };
  } finally {
    client.release();
  }
}

/**
 * 統計情報を表示
 */
async function showStats(): Promise<void> {
  console.log('\n📊 演者名寄せパイプライン 統計情報');
  console.log('='.repeat(50));

  const stats = await getStats();

  console.log(`\n商品統計:`);
  console.log(`  総商品数:           ${stats.totalProducts.toLocaleString()}`);
  console.log(
    `  演者紐付け済み:     ${stats.productsWithPerformers.toLocaleString()} (${((stats.productsWithPerformers / stats.totalProducts) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  未紐付け:           ${stats.productsWithoutPerformers.toLocaleString()} (${((stats.productsWithoutPerformers / stats.totalProducts) * 100).toFixed(1)}%)`,
  );

  console.log(`\nルックアップデータ:`);
  console.log(`  wiki_crawl_data:          ${stats.wikiCrawlDataCount.toLocaleString()} レコード`);
  console.log(`  product_performer_lookup: ${stats.lookupTableCount.toLocaleString()} レコード`);

  // ASP別統計
  const client = await pool.connect();
  try {
    const aspStats = await client.query(`
      SELECT
        ps.asp_name,
        COUNT(DISTINCT p.id) as total,
        COUNT(DISTINCT pp.product_id) as linked
      FROM products p
      INNER JOIN product_sources ps ON p.id = ps.product_id
      LEFT JOIN product_performers pp ON p.id = pp.product_id
      GROUP BY ps.asp_name
      ORDER BY total DESC
    `);

    console.log(`\nASP別統計:`);
    console.log('  ' + '-'.repeat(46));
    console.log(`  ${'ASP'.padEnd(15)} ${'総数'.padStart(8)} ${'紐付済'.padStart(8)} ${'率'.padStart(8)}`);
    console.log('  ' + '-'.repeat(46));

    for (const row of aspStats.rows) {
      const rate = ((row.linked / row.total) * 100).toFixed(1);
      console.log(
        `  ${row.asp_name.padEnd(15)} ${row.total.toString().padStart(8)} ${row.linked.toString().padStart(8)} ${(rate + '%').padStart(8)}`,
      );
    }
  } finally {
    client.release();
  }

  console.log('\n');
}

/**
 * 外部スクリプトを実行
 */
function runScript(scriptPath: string, args: string[] = []): Promise<StepResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log(`\n🚀 実行: npx tsx ${scriptPath} ${args.join(' ')}`);
    console.log('-'.repeat(60));

    const child: ChildProcess = spawn('npx', ['tsx', scriptPath, ...args], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env },
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      if (code === 0) {
        resolve({
          success: true,
          duration,
          message: `完了 (${(duration / 1000).toFixed(1)}秒)`,
        });
      } else {
        resolve({
          success: false,
          duration,
          message: `エラー終了 (code: ${code})`,
        });
      }
    });

    child.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        success: false,
        duration,
        message: `実行エラー: ${error.message}`,
      });
    });
  });
}

/**
 * Step 1: Wikiクローリング
 * wiki_crawl_data, product_performer_lookup テーブルにデータを蓄積
 */
async function stepCrawl(options: { sources?: string[]; limit?: number }): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const sources = options.sources || ['seesaawiki', 'av-wiki', 'shiroutoname'];

  console.log('\n📚 Step 1: Wikiクローリング');
  console.log('='.repeat(50));
  console.log(`対象ソース: ${sources.join(', ')}`);

  for (const source of sources) {
    switch (source) {
      case 'seesaawiki':
        // seesaawiki並列クローラー
        results.push(await runScript('packages/crawlers/src/enrichment/wiki/crawl-wiki-parallel.ts', ['1', '100']));
        break;

      case 'av-wiki':
        // av-wiki クローラー
        results.push(
          await runScript('packages/crawlers/src/performers/wiki-sources/crawl-wiki-performers.ts', [
            'av-wiki-all',
            String(options.limit || 10000),
          ]),
        );
        break;

      case 'shiroutoname':
        // 素人名鑑クローラー
        results.push(
          await runScript('packages/crawlers/src/performers/wiki-sources/crawl-wiki-performers.ts', [
            'shiroutoname-all',
            String(options.limit || 10000),
          ]),
        );
        break;

      default:
        console.log(`  ⚠️ 不明なソース: ${source}`);
    }
  }

  return results;
}

/**
 * Step 2: wiki_crawl_dataから紐付け
 */
async function stepLink(options: { limit?: number; dryRun?: boolean }): Promise<StepResult> {
  console.log('\n🔗 Step 2: wiki_crawl_dataからの演者紐付け');
  console.log('='.repeat(50));

  const args: string[] = [];
  if (options.limit) args.push(`--limit=${options.limit}`);
  if (options.dryRun) args.push('--dry-run');

  return runScript('packages/crawlers/src/enrichment/performer-linking/link-wiki-performers.ts', args);
}

/**
 * Step 3: 未紐付け商品のWeb検索
 */
async function stepSearch(options: { asp?: string; limit?: number }): Promise<StepResult> {
  console.log('\n🔍 Step 3: 未紐付け商品のWeb検索');
  console.log('='.repeat(50));

  const args: string[] = [];
  if (options.limit) args.push(String(options.limit));
  if (options.asp) args.push(options.asp);

  return runScript('scripts/normalize-performers-from-wiki.ts', args);
}

/**
 * 全ステップを実行
 */
async function runAllSteps(options: {
  asp?: string;
  limit?: number;
  dryRun?: boolean;
  sources?: string[];
}): Promise<void> {
  console.log('\n🎯 演者名寄せ統合パイプライン 開始');
  console.log('='.repeat(50));
  console.log(`オプション:`);
  if (options.asp) console.log(`  ASP: ${options.asp}`);
  if (options.limit) console.log(`  処理上限: ${options.limit}`);
  if (options.dryRun) console.log(`  ドライラン: 有効`);
  if (options.sources) console.log(`  クロールソース: ${options.sources.join(', ')}`);

  const startStats = await getStats();
  console.log(`\n開始時点の未紐付け商品: ${startStats.productsWithoutPerformers.toLocaleString()}`);

  const results: { step: string; result: StepResult }[] = [];

  // Step 1: クローリング（ドライラン時はスキップ）
  if (!options.dryRun) {
    const crawlResults = await stepCrawl({
      sources: options.sources,
      limit: options.limit,
    });
    crawlResults.forEach((r, i) => {
      results.push({ step: `crawl-${i + 1}`, result: r });
    });
  }

  // Step 2: 紐付け
  const linkResult = await stepLink({
    limit: options.limit,
    dryRun: options.dryRun,
  });
  results.push({ step: 'link', result: linkResult });

  // Step 3: Web検索（ドライラン時はスキップ）
  if (!options.dryRun) {
    const searchResult = await stepSearch({
      asp: options.asp,
      limit: options.limit ? Math.min(options.limit, 100) : 100, // Web検索は負荷が高いので100件上限
    });
    results.push({ step: 'search', result: searchResult });
  }

  // サマリー表示
  console.log('\n📋 パイプライン実行サマリー');
  console.log('='.repeat(50));

  for (const { step, result } of results) {
    const icon = result.success ? '✅' : '❌';
    console.log(`  ${icon} ${step}: ${result.message}`);
  }

  const endStats = await getStats();
  const newlyLinked = endStats.productsWithPerformers - startStats.productsWithPerformers;

  console.log(`\n📈 結果:`);
  console.log(`  新規紐付け: ${newlyLinked.toLocaleString()} 商品`);
  console.log(`  現在の紐付け率: ${((endStats.productsWithPerformers / endStats.totalProducts) * 100).toFixed(1)}%`);
  console.log(`  残り未紐付け: ${endStats.productsWithoutPerformers.toLocaleString()} 商品`);
}

/**
 * コマンドライン引数をパース
 */
function parseArgs(): {
  step: string;
  asp?: string;
  limit?: number;
  dryRun: boolean;
  sources?: string[];
} {
  const args = process.argv.slice(2);
  const options: ReturnType<typeof parseArgs> = {
    step: 'all',
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--asp=')) {
      options.asp = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--source=')) {
      options.sources = arg.split('=')[1].split(',');
    } else if (!arg.startsWith('-')) {
      options.step = arg;
    }
  }

  return options;
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  const options = parseArgs();

  try {
    switch (options.step) {
      case 'status':
        await showStats();
        break;

      case 'crawl':
        await stepCrawl({
          sources: options.sources,
          limit: options.limit,
        });
        break;

      case 'link':
        await stepLink({
          limit: options.limit,
          dryRun: options.dryRun,
        });
        break;

      case 'search':
        await stepSearch({
          asp: options.asp,
          limit: options.limit,
        });
        break;

      case 'all':
      default:
        await runAllSteps(options);
        break;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('パイプラインエラー:', error);
  process.exit(1);
});
