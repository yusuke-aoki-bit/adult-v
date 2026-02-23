import { NextRequest, NextResponse } from 'next/server';
import { generateSNSSummary } from '../lib/llm-service';
import { createApiErrorResponse } from '../lib/api-logger';

export interface SNSSummaryHandlerDeps {
  getProductWithDetails: (normalizedId: string) => Promise<{
    id: number;
    title: string;
    description: string | null;
    releaseDate: string | null;
    performers: string[];
    tags: string[];
  } | null>;
}

export function createSNSSummaryHandler(deps: SNSSummaryHandlerDeps) {
  return async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const { id } = await params;

      const product = await deps.getProductWithDetails(id);

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      const result = await generateSNSSummary({
        title: product['title'],
        performers: product.performers,
        tags: product.tags,
        ...(product['description'] && { description: product['description'] }),
        ...(product['releaseDate'] && { releaseDate: product['releaseDate'] }),
      });

      if (!result) {
        return NextResponse.json({ error: 'Failed to generate SNS summary' }, { status: 500 });
      }

      return NextResponse.json({ success: true, productId: id, ...result });
    } catch (error) {
      return createApiErrorResponse(error, 'Internal server error', 500, {
        endpoint: '/api/products/[id]/sns-summary',
      });
    }
  };
}
