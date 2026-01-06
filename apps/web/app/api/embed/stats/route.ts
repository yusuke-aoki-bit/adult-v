/**
 * 埋め込みウィジェット用統計データAPI
 * 外部サイトから利用可能（CORS対応）
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOverallStats,
  getTopPerformersByProductCount,
  getTopGenres,
  getMonthlyReleaseStats,
} from '@adult-v/shared/db-queries';

function getCorsHeaders() {
  // 任意のオリジンを許可（埋め込みウィジェット用）
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'overview';
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);

  try {
    let data: unknown;

    switch (type) {
      case 'overview':
        data = await getOverallStats();
        break;
      case 'top-performers':
        data = await getTopPerformersByProductCount(limit);
        break;
      case 'top-genres':
        data = await getTopGenres(limit);
        break;
      case 'monthly-releases':
        const months = Math.min(parseInt(searchParams.get('months') || '12', 10), 24);
        data = await getMonthlyReleaseStats(months);
        break;
      case 'all':
        const [overview, performers, genres, releases] = await Promise.all([
          getOverallStats(),
          getTopPerformersByProductCount(limit),
          getTopGenres(limit),
          getMonthlyReleaseStats(12),
        ]);
        data = {
          overview,
          topPerformers: performers,
          topGenres: genres,
          monthlyReleases: releases,
        };
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use: overview, top-performers, top-genres, monthly-releases, or all' },
          { status: 400, headers: getCorsHeaders() }
        );
    }

    return NextResponse.json(
      {
        success: true,
        data,
        meta: {
          type,
          generatedAt: new Date().toISOString(),
          source: process.env['NEXT_PUBLIC_SITE_URL'] || 'Adult Viewer Lab',
        },
      },
      { headers: getCorsHeaders() }
    );
  } catch (error) {
    console.error('Embed stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}
