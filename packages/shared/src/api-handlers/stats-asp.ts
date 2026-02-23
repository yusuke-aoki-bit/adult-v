import { NextResponse } from 'next/server';
import { logDbErrorAndReturn } from '../lib/db-logger';
import { ASP_STATS_NAME_MAP } from '../asp-registry';

export interface ASPTotal {
  asp: string;
  apiTotal: number | null;
  source?: string;
  error?: string;
}

export interface ASPStat {
  aspName: string;
  productCount: number;
  actressCount?: number;
}

export interface StatsAspHandlerDeps {
  getAspStats: () => Promise<ASPStat[]>;
  getAllASPTotals: (forceRefresh?: boolean) => Promise<ASPTotal[]>;
}

export interface StatsAspHandlerOptions {
  /** FANZAをフィルタ除外する（web版用） */
  excludeFanza?: boolean;
}

// ASP名のマッピング（レジストリから導出）
const ASP_NAME_MAP: Record<string, string> = ASP_STATS_NAME_MAP;

export function createStatsAspHandler(deps: StatsAspHandlerDeps, options: StatsAspHandlerOptions = {}) {
  return async function GET() {
    try {
      // 並列で取得
      const [aspStats, aspTotals] = await Promise.all([
        deps.getAspStats(),
        deps.getAllASPTotals().catch(() => [] as ASPTotal[]),
      ]);

      // ASPTotalsをMap化
      const totalsMap = new Map<string, number>();
      for (const total of aspTotals) {
        if (total.apiTotal) {
          totalsMap.set(total.asp, total.apiTotal);
        }
      }

      // FANZAフィルタ適用
      const filteredStats = options.excludeFanza ? aspStats.filter((stat) => stat.aspName !== 'FANZA') : aspStats;

      // 収集数に推定総数を追加
      const enrichedStats = filteredStats.map((stat) => {
        const mappedName = ASP_NAME_MAP[stat.aspName] || stat.aspName;
        const estimatedTotal = totalsMap.get(mappedName) || null;
        return {
          ...stat,
          estimatedTotal,
        };
      });

      return NextResponse.json(enrichedStats);
    } catch (error) {
      logDbErrorAndReturn(error, [], 'getAspStats');
      // DBエラー時も空配列で200を返す（graceful degradation）
      return NextResponse.json([]);
    }
  };
}
