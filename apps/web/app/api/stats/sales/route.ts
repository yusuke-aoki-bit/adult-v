import { NextResponse } from 'next/server';
import { getSaleStats } from '@/lib/db/queries';

// Cache for 5 minutes
export const revalidate = 300;

export async function GET() {
  try {
    const stats = await getSaleStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch sale stats:', error);
    return NextResponse.json({ totalSales: 0, byAsp: [] }, { status: 500 });
  }
}
