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

// 主要なクローラージョブのリスト
const MAIN_CRAWLER_JOBS = [
  'mgs-crawler',
  'duga-crawler',
  'sokmil-crawler',
  'fc2-crawler',
  'b10f-crawler',
  'heyzo-crawler',
  'ippondo-crawler',
  'caribbeancom-crawler',
  'caribbeancompr-crawler',
  'japanska-crawler',
  'performer-info-crawler',
  'run-migration',
  'generate-reviews',
  'crawl-avwiki-net',
];

// 主要なスケジューラーのリスト
const MAIN_SCHEDULERS = [
  'mgs-parallel-all',
  'mgs-parallel-all-2',
  'mgs-parallel-all-3',
  'duga-crawler-daily',
  'sokmil-crawler-daily',
  'fc2-crawler-daily',
  'performer-pipeline-daily',
  'content-enrichment-daily',
  'seo-enhance-daily',
  'backfill-images-daily',
  'backfill-videos-daily',
  'crawl-avwiki-scheduler',
  'generate-reviews-weekly',
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
const REGION = 'us-central1';

export async function GET() {
  try {
    // gcloud コマンドで Cloud Run Jobs の詳細情報を取得
    const { stdout } = await execAsync(
      `gcloud run jobs list --project=${PROJECT_ID} --region=${REGION} --format="json(name,status.latestCreatedExecution.name,status.latestCreatedExecution.completionStatus,status.latestCreatedExecution.completionTime,status.latestCreatedExecution.startTime)" 2>/dev/null || echo "[]"`,
      { timeout: 30000 }
    );

    let allJobs: Array<{
      name: string;
      status?: {
        latestCreatedExecution?: {
          name?: string;
          completionStatus?: string;
          completionTime?: string;
          startTime?: string;
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
      const job = allJobs.find((j) => j.name?.endsWith(`/${jobName}`));

      if (!job) {
        return {
          name: jobName,
          executionName: null,
          status: 'unknown' as const,
        };
      }

      const execution = job.status?.latestCreatedExecution;
      let status: JobStatus['status'] = 'unknown';

      // Cloud Run Jobsのステータス（RUNNING, SUCCEEDED, FAILEDなど）
      // 完了時刻がなく開始時刻がある場合は実行中とみなす
      const completionStatus = execution?.completionStatus?.toUpperCase() || '';
      if (completionStatus.includes('RUNNING') || (execution?.startTime && !execution?.completionTime)) {
        status = 'running';
      } else if (completionStatus.includes('SUCCEEDED') || completionStatus === 'SUCCEEDED') {
        status = 'succeeded';
      } else if (completionStatus.includes('FAILED') || completionStatus.includes('CANCELLED')) {
        status = 'failed';
      } else if (execution?.completionTime) {
        // 完了時刻があるが上記に該当しない場合は成功とみなす（古いフォーマット対応）
        status = 'succeeded';
      }

      // 実行時間の計算
      let duration: string | undefined;
      if (execution?.startTime) {
        const startTime = new Date(execution.startTime);
        const endTime = execution?.completionTime ? new Date(execution.completionTime) : new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        duration = `${minutes}m ${seconds}s`;
      }

      const executionName = execution?.name?.split('/').pop() || null;

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
        completedAt: execution?.completionTime,
        startedAt: execution?.startTime,
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
      const { stdout: schedulerStdout } = await execAsync(
        `gcloud scheduler jobs list --project=${PROJECT_ID} --location=asia-northeast1 --format="json(name,schedule,timeZone,state,status.lastAttemptTime,status.lastAttemptResult.message,scheduleTime)" 2>/dev/null || echo "[]"`,
        { timeout: 30000 }
      );

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
