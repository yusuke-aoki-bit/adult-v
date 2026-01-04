/**
 * 週次メンテナンス統合パイプライン（Cloud Run Job用）
 *
 * 毎週日曜に実行する全メンテナンスタスクを統合:
 *
 * 1. Translation Backfill - 未翻訳コンテンツの翻訳
 * 2. Performer Tags Update - 演者タグの更新
 * 3. Image Backfill - 画像のバックフィル
 * 4. Data Cleanup - データ整合性チェック・修正
 *
 * Usage:
 *   npx tsx scripts/maintenance/weekly-maintenance.ts [--task=all|translation|performer-tags|images|cleanup]
 */

import { execSync } from 'child_process';
import { parseArgs } from 'util';

interface MaintenanceTask {
  name: string;
  command: string;
  timeout: number; // seconds
  critical: boolean; // falseなら失敗してもパイプライン継続
}

const MAINTENANCE_TASKS: MaintenanceTask[] = [
  {
    name: 'Translation Backfill',
    command: 'npx tsx packages/crawlers/src/enrichment/translation-backfill.ts --limit=500 --type=all',
    timeout: 7200,
    critical: false,
  },
  {
    name: 'Performer Tags Update',
    command: 'npx tsx scripts/update-performer-tags.ts --limit=500',
    timeout: 14400,
    critical: false,
  },
  {
    name: 'Image Backfill',
    command: 'npx tsx scripts/enrichment/image-backfill-all.ts --asp=all --limit=5000',
    timeout: 7200,
    critical: false,
  },
];

interface TaskResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function main() {
  const { values } = parseArgs({
    options: {
      task: { type: 'string', default: 'all' },
    },
  });

  const taskFilter = (values.task as string).toLowerCase();

  console.log('=== Weekly Maintenance Pipeline Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Task:', taskFilter);

  const results: TaskResult[] = [];
  const startTime = Date.now();

  // 対象タスクをフィルタリング
  let targetTasks = MAINTENANCE_TASKS;

  if (taskFilter !== 'all') {
    targetTasks = MAINTENANCE_TASKS.filter(t =>
      t.name.toLowerCase().replace(/\s+/g, '-').includes(taskFilter)
    );
  }

  if (targetTasks.length === 0) {
    console.error(`No tasks found for filter: ${taskFilter}`);
    console.log('Available tasks:', MAINTENANCE_TASKS.map(t => t.name).join(', '));
    process.exit(1);
  }

  console.log(`Running ${targetTasks.length} maintenance tasks...\n`);

  for (const task of targetTasks) {
    const taskStart = Date.now();
    console.log(`\n========== ${task.name} ==========`);

    try {
      console.log(`Command: ${task.command}`);
      console.log(`Timeout: ${task.timeout}s`);
      console.log(`Critical: ${task.critical}`);

      execSync(task.command, {
        stdio: 'inherit',
        env: process.env,
        timeout: task.timeout * 1000,
      });

      results.push({
        name: task.name,
        success: true,
        duration: Date.now() - taskStart,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${task.name} failed:`, errorMessage);

      results.push({
        name: task.name,
        success: false,
        duration: Date.now() - taskStart,
        error: errorMessage.slice(0, 200),
      });

      // criticalタスクが失敗した場合は即座に終了
      if (task.critical) {
        console.error('Critical task failed, aborting pipeline');
        process.exit(1);
      }
    }
  }

  // サマリー出力
  const totalDuration = Date.now() - startTime;
  console.log('\n========================================');
  console.log('=== Weekly Maintenance Pipeline Summary ===');
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

  // non-criticalタスクの失敗は警告として扱う
  if (failureTotal > 0) {
    console.warn(`\n⚠️ ${failureTotal} non-critical tasks failed`);
  }

  console.log('\n=== Weekly Maintenance Pipeline Completed ===');
}

main().catch(console.error);
