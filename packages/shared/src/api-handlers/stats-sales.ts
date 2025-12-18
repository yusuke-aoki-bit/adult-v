import { NextResponse } from 'next/server';

export interface SaleStats {
  totalSales: number;
  byAsp: Array<{ aspName: string; count: number }>;
}

export interface StatsSalesHandlerDeps {
  getSaleStats: (aspFilter?: string) => Promise<SaleStats>;
}

export interface StatsSalesHandlerOptions {
  /** ASPでフィルタする（fanza版: 'FANZA'を指定） */
  aspFilter?: string;
}

export function createStatsSalesHandler(
  deps: StatsSalesHandlerDeps,
  options: StatsSalesHandlerOptions = {}
) {
  return async function GET() {
    try {
      const stats = await deps.getSaleStats(options.aspFilter);
      return NextResponse.json(stats);
    } catch (error) {
      console.error('Failed to fetch sale stats:', error);
      return NextResponse.json({ totalSales: 0, byAsp: [] }, { status: 500 });
    }
  };
}
