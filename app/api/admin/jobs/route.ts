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
];

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

      if (execution?.completionStatus === 'EXECUTION_RUNNING') {
        status = 'running';
      } else if (execution?.completionStatus === 'EXECUTION_SUCCEEDED') {
        status = 'succeeded';
      } else if (execution?.completionStatus === 'EXECUTION_FAILED') {
        status = 'failed';
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
