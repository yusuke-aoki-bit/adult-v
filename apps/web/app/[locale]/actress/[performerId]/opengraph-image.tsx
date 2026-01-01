import { ImageResponse } from 'next/og';
import { getDb } from '@/lib/db';
import { performers } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const alt = 'Actress Profile';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default async function Image({ params }: { params: Promise<{ performerId: string }> }) {
  const { performerId } = await params;

  let actressName = '女優プロフィール';
  let actressImage: string | null = null;
  let productCount = 0;

  try {
    const db = getDb();

    // 女優情報を取得
    const performerData = await db
      .select({
        id: performers.id,
        name: performers.name,
        profileImageUrl: performers.profileImageUrl,
      })
      .from(performers)
      .where(eq(performers.id, parseInt(performerId, 10)))
      .limit(1);

    if (performerData[0]) {
      actressName = performerData[0].name || '女優プロフィール';
      actressImage = performerData[0].profileImageUrl;

      // 作品数を取得
      const countResult = await db.execute(sql`
        SELECT COUNT(DISTINCT product_id) as count
        FROM product_performers
        WHERE performer_id = ${parseInt(performerId, 10)}
      `);
      productCount = Number((countResult.rows[0] as { count: number })?.count) || 0;
    }
  } catch {
    // DB接続失敗時はデフォルト値を使用
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '40px',
        }}
      >
        {/* 左側：プロフィール画像 */}
        <div
          style={{
            width: '380px',
            height: '550px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '50px',
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundColor: '#2a2a4a',
            border: '4px solid #e91e63',
          }}
        >
          {actressImage ? (
            <img
              src={actressImage}
              alt={actressName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 120,
                display: 'flex',
              }}
            >
              👩
            </div>
          )}
        </div>

        {/* 右側：プロフィール情報 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* 女優名 */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '24px',
              display: 'flex',
            }}
          >
            {actressName}
          </div>

          {/* 作品数 */}
          {productCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '32px',
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(90deg, #e91e63, #9c27b0)',
                  color: 'white',
                  padding: '12px 28px',
                  borderRadius: '30px',
                  fontSize: 32,
                  fontWeight: 'bold',
                  display: 'flex',
                }}
              >
                🎬 {productCount.toLocaleString()}作品
              </span>
            </div>
          )}

          {/* 説明文 */}
          <div
            style={{
              fontSize: 28,
              color: '#d1d5db',
              marginBottom: '40px',
              lineHeight: 1.5,
              display: 'flex',
            }}
          >
            作品一覧・出演情報を掲載
          </div>

          {/* サイト名 */}
          <div
            style={{
              fontSize: 28,
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              marginTop: 'auto',
            }}
          >
            <span style={{ marginRight: '12px' }}>🔍</span>
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
