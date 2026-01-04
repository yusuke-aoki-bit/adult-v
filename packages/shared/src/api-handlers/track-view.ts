import { NextRequest, NextResponse } from 'next/server';
import { logApiWarning } from '../lib/api-logger';

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
      logApiWarning(error, 'Error tracking view');
      // Don't fail the request if tracking fails
      return NextResponse.json({ success: false }, { status: 200 });
    }
  };
}
