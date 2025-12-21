import { NextResponse } from 'next/server';

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

// ASP名のマッピング（DB名 -> ASPTotal名）
const ASP_NAME_MAP: Record<string, string> = {
  'b10f.jp': 'b10f',
  'MGS': 'MGS',
  'DUGA': 'DUGA',
  'SOKMIL': 'SOKMIL',
  'Japanska': 'Japanska',
  'FC2': 'FC2',
  // DTI系
  'caribbeancom': 'カリビアンコム',
  'caribbeancompr': 'カリビアンコムプレミアム',
  '1pondo': '一本道',
  'heyzo': 'HEYZO',
  '10musume': '天然むすめ',
  'pacopacomama': 'パコパコママ',
  'muramura': 'ムラムラってくる素人',
  'tokyohot': 'Tokyo-Hot',
};

export function createStatsAspHandler(
  deps: StatsAspHandlerDeps,
  options: StatsAspHandlerOptions = {}
) {
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
      const filteredStats = options.excludeFanza
        ? aspStats.filter(stat => stat.aspName !== 'FANZA')
        : aspStats;

      // 収集数に推定総数を追加
      const enrichedStats = filteredStats.map(stat => {
        const mappedName = ASP_NAME_MAP[stat.aspName] || stat.aspName;
        const estimatedTotal = totalsMap.get(mappedName) || null;
        return {
          ...stat,
          estimatedTotal,
        };
      });

      return NextResponse.json(enrichedStats);
    } catch (error) {
      console.error('Failed to fetch ASP stats:', error);
      return NextResponse.json([], { status: 500 });
    }
  };
}
