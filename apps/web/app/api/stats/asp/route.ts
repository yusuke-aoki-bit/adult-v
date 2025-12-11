import { NextResponse } from 'next/server';
import { getAspStats } from '@/lib/db/queries';
import { getAllASPTotals, type ASPTotal } from '@/lib/asp-totals';

// Cache for 5 minutes
export const revalidate = 300;

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

export async function GET() {
  try {
    // 並列で取得
    const [aspStats, aspTotals] = await Promise.all([
      getAspStats(),
      getAllASPTotals().catch(() => [] as ASPTotal[]),
    ]);

    // ASPTotalsをMap化
    const totalsMap = new Map<string, number>();
    for (const total of aspTotals) {
      if (total.apiTotal) {
        totalsMap.set(total.asp, total.apiTotal);
      }
    }

    // 収集数に推定総数を追加（FANZAは規約により除外）
    const enrichedStats = aspStats
      .filter(stat => stat.aspName !== 'FANZA')
      .map(stat => {
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
}
