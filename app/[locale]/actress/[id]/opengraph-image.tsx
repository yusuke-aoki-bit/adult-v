import { ImageResponse } from 'next/og';
import { getActressById } from '@/lib/db/queries';

export const runtime = 'edge';
export const alt = 'Actress Profile';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actress = await getActressById(id);

  if (!actress) {
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
          女優情報が見つかりません
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
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            {actress.name}
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#9ca3af',
              textAlign: 'center',
            }}
          >
            作品数: {actress.metrics.releaseCount}
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#6b7280',
              marginTop: '20px',
              textAlign: 'center',
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
