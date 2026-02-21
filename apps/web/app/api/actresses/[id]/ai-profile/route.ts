import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 3600;

/**
 * 女優のAIプロフィールを取得
 * GET /api/actresses/[id]/ai-profile
 * 現在はデータソースがないため404を返す
 */
export async function GET(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(null, { status: 404 });
}
