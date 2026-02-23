import { NextRequest, NextResponse } from 'next/server';

export interface MakerByIdHandlerDeps {
  getMakerById: (id: number, locale: string) => Promise<unknown>;
}

export function createMakerByIdHandler(deps: MakerByIdHandlerDeps) {
  return async function GET(request: NextRequest, { params }: { params: Promise<{ makerId: string }> }) {
    try {
      const { makerId } = await params;
      const searchParams = request.nextUrl.searchParams;
      const locale = searchParams.get('locale') || 'ja';

      const makerIdNum = parseInt(makerId, 10);
      if (isNaN(makerIdNum)) {
        return NextResponse.json({ maker: null, error: 'Invalid maker ID' }, { status: 400 });
      }

      const maker = await deps.getMakerById(makerIdNum, locale);

      if (!maker) {
        return NextResponse.json({ maker: null }, { status: 404 });
      }

      return NextResponse.json({ maker });
    } catch (error) {
      console.error('Error fetching maker:', error);
      return NextResponse.json({ maker: null, fallback: true });
    }
  };
}
