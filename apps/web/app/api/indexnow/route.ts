/**
 * IndexNow API - Bing/Yandex等へのインスタントインデックス通知
 *
 * POST /api/indexnow
 * Body: { urls: string[] }
 *
 * @see https://www.indexnow.org/
 */

import { NextRequest, NextResponse } from 'next/server';

const INDEXNOW_KEY = process.env['INDEXNOW_KEY'] || 'adult-v-indexnow-key';
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

// IndexNow対応の検索エンジン
const INDEXNOW_ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
];

export async function POST(request: NextRequest) {
  try {
    // 認証チェック（内部API用）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env['CRON_SECRET'];

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const urls: string[] = body.urls || [];

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
    }

    // 最大10,000 URLまで
    const urlsToSubmit = urls.slice(0, 10000);

    // IndexNowに送信
    const results = await Promise.allSettled(
      INDEXNOW_ENDPOINTS.map(async (endpoint) => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            host: new URL(SITE_URL).host,
            key: INDEXNOW_KEY,
            keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
            urlList: urlsToSubmit,
          }),
        });

        return {
          endpoint,
          status: response.status,
          ok: response.ok,
        };
      })
    );

    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.ok
    ).length;

    return NextResponse.json({
      success: true,
      submitted: urlsToSubmit.length,
      endpoints: results.map((r) =>
        r.status === 'fulfilled'
          ? r.value
          : { endpoint: 'unknown', status: 'error', ok: false }
      ),
      successfulEndpoints: successCount,
    });
  } catch (error) {
    console.error('[IndexNow] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// IndexNow検証用キーファイルへのリダイレクト
export async function GET() {
  // キーファイルの内容を返す
  return new NextResponse(INDEXNOW_KEY, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
