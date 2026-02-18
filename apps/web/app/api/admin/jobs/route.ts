/**
 * Cloud Run Jobs Status API
 * 主要なクローラージョブの実行状況を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
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

// 主要なスケジューラーのリスト（実際のCloud Scheduler名に合わせる）
const MAIN_SCHEDULERS = [
  'mgs-daily-scheduler',
  'crawl-duga-scheduler',
  'crawl-sokmil-scheduler',
  'crawl-fc2-scheduler',
  'crawl-b10f-scheduler',
  'crawl-dti-all-daily',
  'crawl-japanska-scheduler',
  'crawl-tokyohot-scheduler',
  'crawl-sales-scheduler',
  'fanza-daily-scheduler',
  'performer-pipeline-daily',
  'content-enrichment-daily',
  'crawl-avwiki-scheduler',
  'generate-reviews-weekly',
  'seo-enhance-daily',
];

export interface SchedulerStatus {
  name: string;
  schedule: string;
  timeZone: string;
  state: 'ENABLED' | 'PAUSED' | 'UNKNOWN';
  lastAttemptTime?: string;
  lastAttemptStatus?: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  nextRunTime?: string;
}

const PROJECT_ID = 'adult-v';
const REGION = 'asia-northeast1';

export async function GET(request: NextRequest) {
  if (!await verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  try {
    // gcloud コマンドで Cloud Run Jobs の詳細情報を取得
    // JSONフォーマットではcompletionTimestamp, creationTimestampが使われる
    // Windows/Unix両対応のコマンド
    const isWindows = process.platform === 'win32';
    const jobsCommand = isWindows
      ? `gcloud run jobs list --project=${PROJECT_ID} --region=${REGION} --format="json(metadata.name,status.latestCreatedExecution)"`
      : `gcloud run jobs list --project=${PROJECT_ID} --region=${REGION} --format="json(metadata.name,status.latestCreatedExecution)" 2>/dev/null || echo "[]"`;

    let stdout = '[]';
    try {
      const result = await execAsync(jobsCommand, { timeout: 30000 });
      stdout = result.stdout;
    } catch {
      // コマンド失敗時は空配列
      stdout = '[]';
    }

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

    // スケジューラー状態も取得
    let schedulerStatuses: SchedulerStatus[] = [];
    let schedulerSummary = { enabled: 0, paused: 0, failed: 0, succeeded: 0 };

    try {
      const schedulerCommand = isWindows
        ? `gcloud scheduler jobs list --project=${PROJECT_ID} --location=asia-northeast1 --format="json(name,schedule,timeZone,state,status.lastAttemptTime,status.lastAttemptResult.message,scheduleTime)"`
        : `gcloud scheduler jobs list --project=${PROJECT_ID} --location=asia-northeast1 --format="json(name,schedule,timeZone,state,status.lastAttemptTime,status.lastAttemptResult.message,scheduleTime)" 2>/dev/null || echo "[]"`;

      let schedulerStdout = '[]';
      try {
        const schedulerResult = await execAsync(schedulerCommand, { timeout: 30000 });
        schedulerStdout = schedulerResult.stdout;
      } catch {
        schedulerStdout = '[]';
      }

      let allSchedulers: Array<{
        name: string;
        schedule?: string;
        timeZone?: string;
        state?: string;
        status?: {
          lastAttemptTime?: string;
          lastAttemptResult?: { message?: string };
        };
        scheduleTime?: string;
      }> = [];

      try {
        allSchedulers = JSON.parse(schedulerStdout);
      } catch {
        allSchedulers = [];
      }

      schedulerStatuses = MAIN_SCHEDULERS.map((schedulerName) => {
        const scheduler = allSchedulers.find((s) => s.name?.endsWith(`/${schedulerName}`));

        if (!scheduler) {
          return {
            name: schedulerName,
            schedule: '',
            timeZone: 'Asia/Tokyo',
            state: 'UNKNOWN' as const,
          };
        }

        // lastAttemptResultのmessageから成功/失敗を判定
        let lastAttemptStatus: SchedulerStatus['lastAttemptStatus'] = 'UNKNOWN';
        const lastMessage = scheduler.status?.lastAttemptResult?.message || '';
        if (lastMessage.toLowerCase().includes('success') || lastMessage === '') {
          // 空のメッセージは成功として扱う（実行されていない場合）
          if (scheduler.status?.lastAttemptTime) {
            lastAttemptStatus = 'SUCCEEDED';
          }
        } else if (lastMessage.toLowerCase().includes('fail') || lastMessage.toLowerCase().includes('error')) {
          lastAttemptStatus = 'FAILED';
        }

        return {
          name: schedulerName,
          schedule: scheduler.schedule || '',
          timeZone: scheduler.timeZone || 'Asia/Tokyo',
          state: (scheduler.state === 'ENABLED' ? 'ENABLED' : scheduler.state === 'PAUSED' ? 'PAUSED' : 'UNKNOWN') as SchedulerStatus['state'],
          lastAttemptTime: scheduler.status?.lastAttemptTime,
          lastAttemptStatus,
          nextRunTime: scheduler.scheduleTime,
        };
      });

      schedulerSummary = {
        enabled: schedulerStatuses.filter((s) => s.state === 'ENABLED').length,
        paused: schedulerStatuses.filter((s) => s.state === 'PAUSED').length,
        failed: schedulerStatuses.filter((s) => s.lastAttemptStatus === 'FAILED').length,
        succeeded: schedulerStatuses.filter((s) => s.lastAttemptStatus === 'SUCCEEDED').length,
      };
    } catch (schedulerError) {
      console.error('Failed to fetch scheduler status:', schedulerError);
    }

    return NextResponse.json({
      jobs: jobStatuses,
      summary,
      schedulers: schedulerStatuses,
      schedulerSummary,
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
      schedulers: [],
      schedulerSummary: { enabled: 0, paused: 0, failed: 0, succeeded: 0 },
      generatedAt: new Date().toISOString(),
      error: 'Failed to fetch jobs status',
    });
  }
}
