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
      // DBエラー時も空配列で200を返す（graceful degradation）
      return NextResponse.json(defaultHighlights);
    }
  };
}

export const weeklyHighlightsRevalidate = 3600;
