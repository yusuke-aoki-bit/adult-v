import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET() {
  try {
    // テスト用のエラーを発生させる
    throw new Error('Sentry Test Error - This is a test error to verify Sentry integration');
  } catch (error) {
    // エラーをSentryに送信
    Sentry.captureException(error);

    return NextResponse.json({
      message: 'Test error sent to Sentry',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
