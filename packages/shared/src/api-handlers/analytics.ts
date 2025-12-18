import { NextRequest, NextResponse } from 'next/server';

export interface AnalyticsData {
  totalViews: number;
  totalProducts: number;
  totalFavorites: number;
  uniqueVisitors: number;
  topProducts: Array<{ id: number; title: string; views: number }>;
  topPerformers: Array<{ id: number; name: string; views: number }>;
}

export interface AnalyticsHandlerDeps {
  getAnalyticsData: (daysBack: number) => Promise<AnalyticsData>;
}

const VALID_PERIODS = ['daily', 'weekly', 'monthly'] as const;
type Period = (typeof VALID_PERIODS)[number];

function isValidPeriod(value: string | null): value is Period {
  return value !== null && VALID_PERIODS.includes(value as Period);
}

const PERIOD_TO_DAYS: Record<Period, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

export function createAnalyticsHandler(deps: AnalyticsHandlerDeps) {
  return async function GET(request: NextRequest) {
    try {
      const searchParams = request.nextUrl.searchParams;
      const periodParam = searchParams.get('period');

      // Validate period with whitelist
      const period: Period = isValidPeriod(periodParam) ? periodParam : 'weekly';
      const daysBack = PERIOD_TO_DAYS[period];

      const data = await deps.getAnalyticsData(daysBack);

      return NextResponse.json(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analytics data' },
        { status: 500 }
      );
    }
  };
}
