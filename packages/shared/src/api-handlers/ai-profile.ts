import { NextRequest, NextResponse } from 'next/server';

/**
 * AI Profile handler — currently returns 404 (placeholder)
 */
export function createAiProfileHandler() {
  return async function GET(
    _request: NextRequest,
    _context: { params: Promise<{ id: string }> },
  ) {
    return NextResponse.json(null, { status: 404 });
  };
}
