import { NextResponse } from 'next/server';
import { getSaleStats } from '@/lib/db/queries';
import { isServerFanzaSite } from '@/lib/server/site-mode';

// Cache for 5 minutes
export const revalidate = 300;

export async function GET() {
  try {
    const isFanzaSite = await isServerFanzaSite();
    // FANZAサイトの場合はFANZAのみのセール数を返す
    const stats = await getSaleStats(isFanzaSite ? 'FANZA' : undefined);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch sale stats:', error);
    return NextResponse.json({ totalSales: 0, byAsp: [] }, { status: 500 });
  }
}
