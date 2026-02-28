/**
 * Google Indexing API - URL一括送信エンドポイント
 *
 * POST /api/indexing/submit
 * Body: { urls: string[], type?: 'URL_UPDATED' | 'URL_DELETED' }
 *
 * 認証: Bearer CRON_SECRET
 * 制限: 1日200リクエスト（Google Indexing API制限）
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

export const dynamic = 'force-dynamic';

const INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

async function getAuthToken(): Promise<string> {
  const keyJson = process.env['GOOGLE_SERVICE_ACCOUNT_KEY'];

  if (!keyJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
  }

  const credentials = JSON.parse(keyJson);
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  if (!tokenResponse.token) {
    throw new Error('Failed to obtain access token');
  }

  return tokenResponse.token;
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env['CRON_SECRET'];

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const urls: string[] = body.urls || [];
    const type: 'URL_UPDATED' | 'URL_DELETED' = body.type || 'URL_UPDATED';

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
    }

    // Google Indexing API: 1日200リクエスト制限
    const urlsToSubmit = urls.slice(0, 200);

    const token = await getAuthToken();

    const results = await Promise.allSettled(
      urlsToSubmit.map(async (url) => {
        const response = await fetch(INDEXING_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url, type }),
        });

        const data = await response.json().catch(() => ({}));

        return {
          url,
          status: response.status,
          ok: response.ok,
          data,
        };
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
    const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;

    return NextResponse.json({
      success: true,
      type,
      submitted: urlsToSubmit.length,
      succeeded,
      failed,
      results: results.map((r) =>
        r.status === 'fulfilled'
          ? { url: r.value.url, ok: r.value.ok, status: r.value.status }
          : { url: 'unknown', ok: false, error: String(r.reason) },
      ),
    });
  } catch (error) {
    console.error('[Google Indexing API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
