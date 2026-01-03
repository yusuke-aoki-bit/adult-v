import { NextRequest, NextResponse } from 'next/server';
import { generateSNSSummary } from '../lib/llm-service';

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
  return async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const { id } = await params;

      const product = await deps.getProductWithDetails(id);

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      const result = await generateSNSSummary({
        title: product.title,
        performers: product.performers,
        tags: product.tags,
        description: product.description || undefined,
        releaseDate: product.releaseDate || undefined,
      });

      if (!result) {
        return NextResponse.json({ error: 'Failed to generate SNS summary' }, { status: 500 });
      }

      return NextResponse.json({ success: true, productId: id, ...result });
    } catch (error) {
      console.error('[SNS Summary API] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
