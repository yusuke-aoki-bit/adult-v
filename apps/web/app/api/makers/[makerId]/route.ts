import { NextRequest, NextResponse } from 'next/server';
import { getMakerById } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ makerId: string }> }
) {
  try {
    const { makerId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const locale = searchParams.get('locale') || 'ja';

    const makerIdNum = parseInt(makerId, 10);
    if (isNaN(makerIdNum)) {
      return NextResponse.json({ maker: null, error: 'Invalid maker ID' }, { status: 400 });
    }

    const maker = await getMakerById(makerIdNum, locale);

    if (!maker) {
      return NextResponse.json({ maker: null }, { status: 404 });
    }

    return NextResponse.json({ maker });
  } catch (error) {
    console.error('Error fetching maker:', error);
    return NextResponse.json({ maker: null }, { status: 500 });
  }
}
