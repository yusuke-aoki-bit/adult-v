import { NextResponse } from 'next/server';
import { getActressById } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Actress ID is required' },
        { status: 400 }
      );
    }

    const actress = await getActressById(id);

    if (!actress) {
      return NextResponse.json(
        { error: 'Actress not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(actress);
  } catch (error) {
    console.error('Error fetching actress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch actress' },
      { status: 500 }
    );
  }
}


