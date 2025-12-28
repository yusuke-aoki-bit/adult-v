/**
 * 画像バックフィル統合スクリプト（Cloud Run Job用）
 *
 * すべてのASPの画像バックフィル処理を順次実行:
 *
 * - 1pondo: サンプル画像（gallery.zip）
 * - DUGA: 画像サイズ変換（240x180 → 640x480）
 * - Sokmil: 画像サイズ変換
 * - DTI: サンプル画像取得
 *
 * Usage:
 *   npx tsx scripts/enrichment/image-backfill-all.ts [--asp=all|1pondo|duga|sokmil|dti] [--limit=5000]
 */

import { execSync } from 'child_process';
import { parseArgs } from 'util';

interface BackfillTask {
  name: string;
  asp: string;
  command: string;
}

const BACKFILL_TASKS: BackfillTask[] = [
  {
    name: '1pondo Sample Images',
    asp: '1pondo',
    command: 'npx tsx packages/crawlers/src/enrichment/backfill-1pondo-sample-images.ts',
  },
  {
    name: 'DUGA Image Sizes',
    asp: 'duga',
    command: 'npx tsx packages/crawlers/src/enrichment/backfill-duga-image-sizes.ts',
  },
  {
    name: 'Sokmil Image Sizes',
    asp: 'sokmil',
    command: 'npx tsx packages/crawlers/src/enrichment/backfill-sokmil-image-sizes.ts',
  },
];

interface TaskResult {
  name: string;
  asp: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function main() {
  const { values } = parseArgs({
    options: {
      asp: { type: 'string', default: 'all' },
      limit: { type: 'string', default: '5000' },
    },
  });

  const aspFilter = (values.asp as string).toLowerCase();
  const limit = parseInt(values.limit as string, 10);

  console.log('=== Image Backfill Pipeline Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('ASP Filter:', aspFilter);
  console.log('Limit per task:', limit);

  const results: TaskResult[] = [];
  const startTime = Date.now();

  // 対象タスクをフィルタリング
  const targetTasks = aspFilter === 'all'
    ? BACKFILL_TASKS
    : BACKFILL_TASKS.filter(t => t.asp === aspFilter);

  if (targetTasks.length === 0) {
    console.error(`No tasks found for ASP: ${aspFilter}`);
    console.log('Available ASPs:', BACKFILL_TASKS.map(t => t.asp).join(', '));
    process.exit(1);
  }

  for (const task of targetTasks) {
    const taskStart = Date.now();
    console.log(`\n========== ${task.name} ==========`);

    try {
      const command = `${task.command} --limit=${limit}`;
      console.log(`Executing: ${command}`);
      execSync(command, { stdio: 'inherit', env: process.env });

      results.push({
        name: task.name,
        asp: task.asp,
        success: true,
        duration: Date.now() - taskStart,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${task.name} failed:`, errorMessage);

      results.push({
        name: task.name,
        asp: task.asp,
        success: false,
        duration: Date.now() - taskStart,
        error: errorMessage,
      });
    }
  }

  // サマリー出力
  const totalDuration = Date.now() - startTime;
  console.log('\n========================================');
  console.log('=== Image Backfill Pipeline Summary ===');
  console.log('========================================');

  for (const r of results) {
    const status = r.success ? '✅' : '❌';
    const duration = Math.round(r.duration / 1000);
    console.log(`${status} ${r.name} (${duration}s)`);
    if (r.error) {
      console.log(`   Error: ${r.error.slice(0, 100)}`);
    }
  }

  // 全体統計
  const successTotal = results.filter(r => r.success).length;
  const failureTotal = results.filter(r => !r.success).length;

  console.log('\n----------------------------------------');
  console.log(`Total: ${successTotal} succeeded, ${failureTotal} failed`);
  console.log(`Duration: ${Math.round(totalDuration / 1000)}s (${Math.round(totalDuration / 60000)}min)`);
  console.log('========================================');

  if (failureTotal > 0) {
    console.error(`\n${failureTotal} tasks failed`);
    process.exit(1);
  }

  console.log('\n=== Image Backfill Pipeline Completed ===');
}

main().catch(console.error);
