import { ImageResponse } from 'next/og';
import { getProductById } from '@/lib/db/queries';

export const runtime = 'edge';
export const alt = 'Product Detail';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 48,
            background: 'linear-gradient(to bottom, #1f2937, #111827)',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          作品情報が見つかりません
        </div>
      ),
      {
        ...size,
      }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #1f2937, #111827)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            marginRight: '40px',
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '20px',
              lineHeight: 1.2,
            }}
          >
            {product.title.length > 50 ? product.title.slice(0, 50) + '...' : product.title}
          </div>
          {product.actressName && (
            <div
              style={{
                fontSize: 32,
                color: '#e879f9',
                marginBottom: '12px',
              }}
            >
              {product.actressName}
            </div>
          )}
          <div
            style={{
              fontSize: 24,
              color: '#9ca3af',
            }}
          >
            {product.providerLabel}
          </div>
          {product.price && (
            <div
              style={{
                fontSize: 32,
                color: '#f43f5e',
                marginTop: '20px',
                fontWeight: 'bold',
              }}
            >
              ¥{product.price.toLocaleString()}
            </div>
          )}
          <div
            style={{
              fontSize: 20,
              color: '#6b7280',
              marginTop: 'auto',
              paddingTop: '20px',
            }}
          >
            ADULT VIEWER LAB
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
