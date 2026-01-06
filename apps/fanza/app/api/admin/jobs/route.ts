/**
 * Cloud Run Jobs Status API
 * 主要なクローラージョブの実行状況を取得
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface JobStatus {
  name: string;
  executionName: string | null;
  status: 'running' | 'succeeded' | 'failed' | 'unknown';
  completedAt?: string;
  startedAt?: string;
  duration?: string;
  logsUrl?: string;
  consoleUrl?: string;
}

// 主要なクローラージョブのリスト（実際のCloud Run Job名に合わせる）
const MAIN_CRAWLER_JOBS = [
  'mgs-daily',
  'crawl-duga',
  'crawl-sokmil',
  'crawl-fc2',
  'crawl-b10f',
  'crawl-dti-all',
  'crawl-japanska',
  'crawl-tokyohot',
  'crawl-sales',
  'fanza-daily',
  'enrich-performers',
  'link-wiki-performers',
  'crawl-avwiki-net',
  'generate-reviews',
  'run-migration',
];

const PROJECT_ID = 'adult-v';
const REGION = 'asia-northeast1';

export async function GET() {
  try {
    // gcloud コマンドで Cloud Run Jobs の詳細情報を取得
    // JSONフォーマットではcompletionTimestamp, creationTimestampが使われる
    const { stdout } = await execAsync(
      `gcloud run jobs list --project=${PROJECT_ID} --region=${REGION} --format="json(metadata.name,status.latestCreatedExecution)" 2>/dev/null || echo "[]"`,
      { timeout: 30000 }
    );

    let allJobs: Array<{
      metadata?: {
        name?: string;
      };
      status?: {
        latestCreatedExecution?: {
          name?: string;
          completionStatus?: string;
          completionTimestamp?: string;
          creationTimestamp?: string;
        };
      };
    }> = [];

    try {
      allJobs = JSON.parse(stdout);
    } catch {
      // JSONパース失敗時は空配列
      allJobs = [];
    }

    // 主要なクローラージョブのみをフィルタして整形
    const jobStatuses: JobStatus[] = MAIN_CRAWLER_JOBS.map((jobName) => {
      const job = allJobs.find((j) => j.metadata?.name === jobName);

      if (!job) {
        return {
          name: jobName,
          executionName: null,
          status: 'unknown' as const,
        };
      }

      const execution = job.status?.latestCreatedExecution;
      let status: JobStatus['status'] = 'unknown';

      // Cloud Run Jobsのステータス（EXECUTION_SUCCEEDED, EXECUTION_FAILEDなど）
      // 完了時刻がなく作成時刻がある場合は実行中とみなす
      const completionStatus = execution?.completionStatus?.toUpperCase() || '';
      if (completionStatus.includes('RUNNING') || (execution?.creationTimestamp && !execution?.completionTimestamp)) {
        status = 'running';
      } else if (completionStatus.includes('SUCCEEDED')) {
        status = 'succeeded';
      } else if (completionStatus.includes('FAILED') || completionStatus.includes('CANCELLED')) {
        status = 'failed';
      } else if (execution?.completionTimestamp) {
        // 完了時刻があるが上記に該当しない場合は成功とみなす（古いフォーマット対応）
        status = 'succeeded';
      }

      // 実行時間の計算
      let duration: string | undefined;
      if (execution?.creationTimestamp) {
        const startTime = new Date(execution.creationTimestamp);
        const endTime = execution?.completionTimestamp ? new Date(execution.completionTimestamp) : new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        duration = `${minutes}m ${seconds}s`;
      }

      const executionName = execution?.name || null;

      // Cloud Console URLの生成
      const consoleUrl = `https://console.cloud.google.com/run/jobs/details/${REGION}/${jobName}/executions?project=${PROJECT_ID}`;

      // Cloud Logging URLの生成（実行中または直近の実行のログ）
      const logsUrl = executionName
        ? `https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_job%22%0Aresource.labels.job_name%3D%22${jobName}%22%0Aresource.labels.location%3D%22${REGION}%22;?project=${PROJECT_ID}`
        : undefined;

      return {
        name: jobName,
        executionName,
        status,
        completedAt: execution?.completionTimestamp,
        startedAt: execution?.creationTimestamp,
        duration,
        logsUrl,
        consoleUrl,
      };
    });

    // サマリーを計算
    const summary = {
      running: jobStatuses.filter((j) => j.status === 'running').length,
      succeeded: jobStatuses.filter((j) => j.status === 'succeeded').length,
      failed: jobStatuses.filter((j) => j.status === 'failed').length,
      unknown: jobStatuses.filter((j) => j.status === 'unknown').length,
    };

    return NextResponse.json({
      jobs: jobStatuses,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch Cloud Run jobs status:', error);

    // エラー時はダミーデータを返す（gcloud が利用できない環境用）
    const dummyJobs: JobStatus[] = MAIN_CRAWLER_JOBS.map((name) => ({
      name,
      executionName: null,
      status: 'unknown' as const,
      consoleUrl: `https://console.cloud.google.com/run/jobs/details/${REGION}/${name}/executions?project=${PROJECT_ID}`,
    }));

    return NextResponse.json({
      jobs: dummyJobs,
      summary: { running: 0, succeeded: 0, failed: 0, unknown: MAIN_CRAWLER_JOBS.length },
      generatedAt: new Date().toISOString(),
      error: 'Failed to fetch jobs status',
    });
  }
}
