/**
 * Sentry Tunnel Route
 *
 * This route proxies Sentry error reports through our server to bypass ad-blockers.
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/troubleshooting/#tunnel
 */

import { NextRequest, NextResponse } from 'next/server';

const SENTRY_HOST = 'sentry.io';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const pieces = body.split('\n');

    // Parse the envelope header to extract the DSN
    const header = JSON.parse(pieces[0] || '{}');
    const dsn = header.dsn as string | undefined;

    if (!dsn) {
      console.warn('[Sentry Tunnel] No DSN in envelope header');
      return NextResponse.json({ error: 'Missing DSN' }, { status: 400 });
    }

    // Parse DSN to get project ID and host
    const dsnUrl = new URL(dsn);
    const projectId = dsnUrl.pathname.replace('/', '');

    // Validate the DSN host (security measure)
    if (dsnUrl.hostname !== SENTRY_HOST && !dsnUrl.hostname.endsWith('.sentry.io')) {
      console.warn('[Sentry Tunnel] Invalid Sentry host:', dsnUrl.hostname);
      return NextResponse.json({ error: 'Invalid host' }, { status: 400 });
    }

    // Forward to Sentry
    const sentryUrl = `https://${SENTRY_HOST}/api/${projectId}/envelope/`;

    const response = await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
      },
      body,
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Sentry Tunnel] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
