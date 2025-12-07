/**
 * 統合ワークフロー実行スクリプト
 *
 * 実行順序:
 * 1. ASPから商品情報収集 - 各クローラで商品データを取得
 * 2. 女優と品名の紐づけ収集 - 商品データから女優を抽出・紐づけ
 * 3. 女優の別名収集 - 登録された女優に対して別名を生成
 * 4. AIで女優レビューを作成 - 紐づけ済みデータでレビュー生成
 * 5. 多言語化対応 - 生成されたコンテンツを翻訳
 *
 * Usage:
 *   npx tsx scripts/run-workflow.ts [step] [options]
 *
 * Steps:
 *   all          - 全ステップを実行
 *   crawl        - Step 1: 商品情報収集
 *   link         - Step 2: 女優紐づけ
 *   aliases      - Step 3: 別名収集
 *   ai-review    - Step 4: AIレビュー生成
 *   translate    - Step 5: 多言語化
 *
 * Options:
 *   --limit <n>  - 処理件数の上限
 *   --asp <name> - 特定ASPのみ (crawl時)
 *   --skip-crawl - crawlをスキップ (all時)
 */

import { execSync } from 'child_process';

const step = process.argv[2] || 'all';
const args = process.argv.slice(3);
const limitArg = args.find((arg, i) => args[i - 1] === '--limit');
const aspArg = args.find((arg, i) => args[i - 1] === '--asp');
const skipCrawl = args.includes('--skip-crawl');

function exec(command: string, description: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📌 ${description}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`> ${command}\n`);
  try {
    execSync(command, { stdio: 'inherit', env: process.env });
    console.log(`✅ ${description} 完了\n`);
  } catch (error) {
    console.error(`❌ ${description} 失敗`);
    throw error;
  }
}

async function step1_crawl() {
  console.log('\n🔄 Step 1: ASPから商品情報収集\n');

  const asps = aspArg ? [aspArg] : ['duga-api', 'sokmil', 'mgs', 'b10f', '1pondo', 'caribbeancom', 'heyzo'];
  const limit = limitArg || '100';

  for (const asp of asps) {
    try {
      exec(`npx tsx scripts/run-crawler.ts ${asp} --limit ${limit}`, `${asp.toUpperCase()} クローラー`);
    } catch (error) {
      console.warn(`⚠️ ${asp} クローラーでエラー発生、続行します`);
    }
  }
}

async function step2_link() {
  console.log('\n🔗 Step 2: 女優と品名の紐づけ収集\n');

  // タイトルから女優名を抽出して紐づけ
  exec('npx tsx scripts/backfill/match-performers-from-title.ts', 'タイトルから女優名抽出');

  // 各ASP固有の紐づけ処理
  const backfillScripts = [
    { script: 'backfill-dti-title-performers.ts', desc: 'DTI女優紐づけ' },
    { script: 'backfill-b10f-title-performers.ts', desc: 'b10f女優紐づけ' },
    { script: 'backfill-duga-performers.ts', desc: 'DUGA女優紐づけ' },
    { script: 'backfill-mgs-performers.ts', desc: 'MGS女優紐づけ' },
    { script: 'backfill-sokmil-performers.ts', desc: 'SOKMIL女優紐づけ' },
  ];

  for (const { script, desc } of backfillScripts) {
    try {
      exec(`npx tsx scripts/backfill/${script}`, desc);
    } catch (error) {
      console.warn(`⚠️ ${desc} でエラー発生、続行します`);
    }
  }
}

async function step3_aliases() {
  console.log('\n📝 Step 3: 女優の別名収集\n');

  // 外部ソースからの収集
  try {
    exec('npx tsx scripts/run-crawler.ts wikipedia-ja', 'Wikipedia日本語から別名収集');
  } catch (error) {
    console.warn('⚠️ Wikipedia収集でエラー発生、続行します');
  }

  try {
    exec('npx tsx scripts/run-crawler.ts avwiki-tokyo', 'AVWiki Tokyoから別名収集');
  } catch (error) {
    console.warn('⚠️ AVWiki収集でエラー発生、続行します');
  }

  // 自動生成（ひらがな/カタカナ変換）
  exec('npx tsx scripts/generate-performer-aliases-batch.ts', '別名自動生成（かな変換）');
}

async function step4_aiReview() {
  console.log('\n🤖 Step 4: AIで女優レビューを作成\n');

  const limit = limitArg || '100';
  exec(`npx tsx scripts/generate-performer-reviews.ts --limit=${limit}`, 'AI女優レビュー生成');
}

async function step5_translate() {
  console.log('\n🌐 Step 5: 多言語化対応\n');

  const limit = limitArg || '100';
  exec(`npx tsx scripts/backfill/backfill-translations.ts --limit=${limit}`, 'タイトル・説明文翻訳');
}

async function main() {
  console.log('🚀 統合ワークフロー開始');
  console.log(`   ステップ: ${step}`);
  console.log(`   引数: ${args.join(' ') || 'なし'}`);

  try {
    switch (step) {
      case 'all':
        if (!skipCrawl) {
          await step1_crawl();
        } else {
          console.log('⏭️ crawlをスキップ');
        }
        await step2_link();
        await step3_aliases();
        await step4_aiReview();
        await step5_translate();
        break;

      case 'crawl':
        await step1_crawl();
        break;

      case 'link':
        await step2_link();
        break;

      case 'aliases':
        await step3_aliases();
        break;

      case 'ai-review':
        await step4_aiReview();
        break;

      case 'translate':
        await step5_translate();
        break;

      default:
        console.error(`Unknown step: ${step}`);
        console.log('\nAvailable steps: all, crawl, link, aliases, ai-review, translate');
        process.exit(1);
    }

    console.log('\n✨ ワークフロー完了!');
  } catch (error) {
    console.error('\n❌ ワークフローでエラーが発生しました:', error);
    process.exit(1);
  }
}

main();
