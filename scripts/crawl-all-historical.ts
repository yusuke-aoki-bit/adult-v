/**
 * 全ASP過去商品一括収集スクリプト
 *
 * 全クローラーを順番に実行し、過去の商品を収集します。
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/crawl-all-historical.ts [--skip=sokmil,duga] [--only=tmp,caribbean]
 */

import { spawn } from 'child_process';
import * as path from 'path';

// クローラー設定
interface CrawlerConfig {
  name: string;
  script: string;
  args: string[];
  description: string;
}

const CRAWLERS: CrawlerConfig[] = [
  // API系（フルスキャン対応）
  {
    name: 'sokmil',
    script: 'packages/crawlers/src/products/crawl-sokmil-api-v2.ts',
    args: ['--full-scan'],
    description: 'SOKMIL API (全件)',
  },
  {
    name: 'duga',
    script: 'packages/crawlers/src/products/crawl-duga-api-v2.ts',
    args: ['--full-scan'],
    description: 'DUGA API (全件)',
  },

  // スクレイピング系（商品がなくなるまで自動継続）
  {
    name: 'fanza',
    script: 'packages/crawlers/src/products/crawl-fanza.ts',
    args: ['--full-scan', '--max-pages=999999'],
    description: 'FANZA (全ページ)',
  },

  // TMP系
  {
    name: 'heydouga',
    script: 'packages/crawlers/src/products/crawl-tmp.ts',
    args: ['--site=heydouga', '--pages=999999'],
    description: 'Hey動画 (全ページ)',
  },
  {
    name: 'x1x',
    script: 'packages/crawlers/src/products/crawl-tmp.ts',
    args: ['--site=x1x', '--pages=999999'],
    description: 'X1X (全ページ)',
  },
  {
    name: 'enkou55',
    script: 'packages/crawlers/src/products/crawl-tmp.ts',
    args: ['--site=enkou55', '--pages=999999'],
    description: '援交55 (全ページ)',
  },
  {
    name: 'urekko',
    script: 'packages/crawlers/src/products/crawl-tmp.ts',
    args: ['--site=urekko', '--pages=999999'],
    description: '熟っ子倶楽部 (全ページ)',
  },

  // Caribbean系（DTI）
  {
    name: 'caribbean',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=caribbeancom', '--pages=999999'],
    description: 'カリビアンコム (全ページ)',
  },
  {
    name: 'caribbeanpr',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=caribbeancompr', '--pages=999999'],
    description: 'カリビアンコムプレミアム (全ページ)',
  },
  {
    name: '1pondo',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=1pondo', '--pages=999999'],
    description: '一本道 (全ページ)',
  },
  {
    name: 'heyzo',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=heyzo', '--pages=999999'],
    description: 'HEYZO (全ページ)',
  },
  {
    name: 'tenmusume',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=10musume', '--pages=999999'],
    description: '天然むすめ (全ページ)',
  },
  {
    name: 'pacopacomama',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=pacopacomama', '--pages=999999'],
    description: 'パコパコママ (全ページ)',
  },
  {
    name: 'muramura',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=muramura', '--pages=999999'],
    description: 'むらむら (全ページ)',
  },
  {
    name: 'h4610',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=h4610', '--pages=999999'],
    description: 'エッチな4610 (全ページ)',
  },
  {
    name: 'h0930',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=h0930', '--pages=999999'],
    description: '人妻斬り H0930 (全ページ)',
  },
  {
    name: 'c0930',
    script: 'packages/crawlers/src/products/crawl-caribbean.ts',
    args: ['--site=c0930', '--pages=999999'],
    description: '人妻斬り C0930 (全ページ)',
  },

  // Tokyo-Hot系
  {
    name: 'tokyohot',
    script: 'packages/crawlers/src/products/crawl-tokyohot.ts',
    args: ['--pages=999999'],
    description: 'Tokyo-Hot (全ページ)',
  },

  // Japanska
  {
    name: 'japanska',
    script: 'packages/crawlers/src/products/crawl-japanska.ts',
    args: ['--pages', '999999', '--limit', '999999', '--no-ai'],
    description: 'Japanska (全件)',
  },

  // FC2
  {
    name: 'fc2',
    script: 'packages/crawlers/src/products/crawl-fc2-video.ts',
    args: ['--limit', '999999'],
    description: 'FC2動画 (全件)',
  },

  // b10f (CSV全件なのでデフォルトで全件取得)
  {
    name: 'b10f',
    script: 'packages/crawlers/src/products/crawl-b10f-csv.ts',
    args: [],
    description: 'b10f (CSV全件)',
  },
];

/**
 * クローラーを実行
 */
async function runCrawler(config: CrawlerConfig): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 ${config.name.toUpperCase()}: ${config.description}`);
    console.log(`   Script: ${config.script}`);
    console.log(`   Args: ${config.args.join(' ') || '(none)'}`);
    console.log('='.repeat(60));

    const scriptPath = path.resolve(process.cwd(), config.script);
    const child = spawn('npx', ['tsx', scriptPath, ...config.args], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
      },
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${config.name.toUpperCase()} completed successfully`);
        resolve(true);
      } else {
        console.log(`\n❌ ${config.name.toUpperCase()} failed with code ${code}`);
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.error(`\n❌ ${config.name.toUpperCase()} error:`, error);
      resolve(false);
    });
  });
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  console.log('🌐 全ASP過去商品一括収集スクリプトを開始します...\n');

  const args = process.argv.slice(2);
  const skipArg = args.find(a => a.startsWith('--skip='))?.split('=')[1];
  const onlyArg = args.find(a => a.startsWith('--only='))?.split('=')[1];

  const skipList = skipArg ? skipArg.split(',') : [];
  const onlyList = onlyArg ? onlyArg.split(',') : [];

  let crawlers = CRAWLERS;

  // フィルタリング
  if (onlyList.length > 0) {
    crawlers = crawlers.filter(c => onlyList.includes(c.name));
    console.log(`📋 指定されたクローラーのみ実行: ${onlyList.join(', ')}`);
  } else if (skipList.length > 0) {
    crawlers = crawlers.filter(c => !skipList.includes(c.name));
    console.log(`📋 スキップするクローラー: ${skipList.join(', ')}`);
  }

  console.log(`\n📊 実行予定のクローラー数: ${crawlers.length}`);
  console.log('─'.repeat(40));
  for (const crawler of crawlers) {
    console.log(`  • ${crawler.name}: ${crawler.description}`);
  }
  console.log('─'.repeat(40));

  const results: { name: string; success: boolean }[] = [];

  for (const crawler of crawlers) {
    const success = await runCrawler(crawler);
    results.push({ name: crawler.name, success });
  }

  // 結果サマリー
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📊 実行結果サマリー');
  console.log('═'.repeat(60));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.name}`);
  }

  console.log('─'.repeat(40));
  console.log(`  成功: ${successCount}/${results.length}`);
  console.log(`  失敗: ${failCount}/${results.length}`);
  console.log('═'.repeat(60));

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
