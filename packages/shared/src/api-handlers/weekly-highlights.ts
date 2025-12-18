import { NextResponse } from 'next/server';

interface WeeklyHighlightsResult {
  trendingActresses: unknown[];
  hotNewReleases: unknown[];
  rediscoveredClassics: unknown[];
}

export interface WeeklyHighlightsHandlerDeps {
  getWeeklyHighlights: () => Promise<WeeklyHighlightsResult>;
}

export function createWeeklyHighlightsHandler(deps: WeeklyHighlightsHandlerDeps) {
  return async function GET() {
    try {
      const highlights = await deps.getWeeklyHighlights();

      return NextResponse.json(highlights);
    } catch (error) {
      console.error('Failed to get weekly highlights:', error);
      return NextResponse.json({
        trendingActresses: [],
        hotNewReleases: [],
        rediscoveredClassics: [],
      }, { status: 500 });
    }
  };
}

export const weeklyHighlightsRevalidate = 3600;
