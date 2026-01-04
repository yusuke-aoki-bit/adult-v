import { NextResponse } from 'next/server';
import { logDbErrorAndReturn } from '../lib/db-logger';

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
      const defaultHighlights = {
        trendingActresses: [],
        hotNewReleases: [],
        rediscoveredClassics: [],
      };
      logDbErrorAndReturn(error, defaultHighlights, 'getWeeklyHighlights');
      return NextResponse.json(defaultHighlights, { status: 500 });
    }
  };
}

export const weeklyHighlightsRevalidate = 3600;
