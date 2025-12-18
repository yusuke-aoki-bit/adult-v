import { NextRequest, NextResponse } from 'next/server';

interface TrackViewRequest {
  productId?: number;
  performerId?: number;
}

export interface TrackViewHandlerDeps {
  trackProductView: (productId: number) => Promise<void>;
  trackPerformerView: (performerId: number) => Promise<void>;
}

export function createTrackViewHandler(deps: TrackViewHandlerDeps) {
  return async function POST(request: NextRequest) {
    try {
      const body: TrackViewRequest = await request.json();

      if (body.productId) {
        await deps.trackProductView(body.productId);
      }

      if (body.performerId) {
        await deps.trackPerformerView(body.performerId);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error tracking view:', error);
      // Don't fail the request if tracking fails
      return NextResponse.json({ success: false }, { status: 200 });
    }
  };
}
