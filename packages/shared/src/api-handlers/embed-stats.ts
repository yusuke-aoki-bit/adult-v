import { NextRequest, NextResponse } from 'next/server';
import { CACHE } from './constants/cache';

export interface EmbedStatsHandlerDeps {
  getOverallStats: () => Promise<unknown>;
  getTopPerformersByProductCount: (limit: number) => Promise<unknown>;
  getTopGenres: (limit: number) => Promise<unknown>;
  getMonthlyReleaseStats: (months: number) => Promise<unknown>;
}

export interface EmbedStatsHandlerOptions {
  sourceLabel?: string;
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': CACHE.ONE_HOUR,
  };
}

export function createEmbedStatsHandler(deps: EmbedStatsHandlerDeps, options: EmbedStatsHandlerOptions = {}) {
  const sourceLabel = options.sourceLabel || 'Adult Viewer Lab';

  async function OPTIONS() {
    return new NextResponse(null, {
      status: 200,
      headers: getCorsHeaders(),
    });
  }

  async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20);

    try {
      let data: unknown;

      switch (type) {
        case 'overview':
          data = await deps.getOverallStats();
          break;
        case 'top-performers':
          data = await deps.getTopPerformersByProductCount(limit);
          break;
        case 'top-genres':
          data = await deps.getTopGenres(limit);
          break;
        case 'monthly-releases': {
          const months = Math.min(parseInt(searchParams.get('months') || '12', 10), 24);
          data = await deps.getMonthlyReleaseStats(months);
          break;
        }
        case 'all': {
          const [overview, performers, genres, releases] = await Promise.all([
            deps.getOverallStats(),
            deps.getTopPerformersByProductCount(limit),
            deps.getTopGenres(limit),
            deps.getMonthlyReleaseStats(12),
          ]);
          data = {
            overview,
            topPerformers: performers,
            topGenres: genres,
            monthlyReleases: releases,
          };
          break;
        }
        default:
          return NextResponse.json(
            { error: 'Invalid type parameter. Use: overview, top-performers, top-genres, monthly-releases, or all' },
            { status: 400, headers: getCorsHeaders() },
          );
      }

      return NextResponse.json(
        {
          success: true,
          data,
          meta: {
            type,
            generatedAt: new Date().toISOString(),
            source: process.env['NEXT_PUBLIC_SITE_URL'] || sourceLabel,
          },
        },
        { headers: getCorsHeaders() },
      );
    } catch (error) {
      console.error('Embed stats API error:', error);
      return NextResponse.json(
        {
          success: false,
          fallback: true,
          data: null,
          meta: {
            type: 'error',
            generatedAt: new Date().toISOString(),
            source: process.env['NEXT_PUBLIC_SITE_URL'] || sourceLabel,
          },
        },
        { headers: getCorsHeaders() },
      );
    }
  }

  return { GET, OPTIONS };
}
