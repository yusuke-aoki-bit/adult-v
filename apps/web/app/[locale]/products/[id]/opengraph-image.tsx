import { ImageResponse } from 'next/og';
import { getDb } from '@/lib/db';
import { products, productSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const alt = 'Product Detail';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
export const runtime = 'nodejs';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let productTitle = '作品詳細';
  let productImage: string | null = null;
  let providerName = '';
  let price: number | null = null;

  try {
    const db = getDb();

    // 商品情報を取得
    const productData = await db
      .select({
        id: products.id,
        title: products.title,
        thumbnailUrl: products.thumbnailUrl,
      })
      .from(products)
      .where(eq(products.id, parseInt(id, 10)))
      .limit(1);

    if (productData[0]) {
      productTitle = productData[0].title || '作品詳細';
      productImage = productData[0].thumbnailUrl;

      // ソース情報を取得（価格・プロバイダー）
      const sourceData = await db
        .select({
          aspName: productSources.aspName,
          price: productSources.price,
        })
        .from(productSources)
        .where(eq(productSources.productId, parseInt(id, 10)))
        .limit(1);

      if (sourceData[0]) {
        providerName = sourceData[0].aspName || '';
        price = sourceData[0].price;
      }
    }
  } catch {
    // DB接続失敗時はデフォルト値を使用
  }

  // タイトルが長すぎる場合は省略
  const displayTitle = productTitle.length > 50
    ? productTitle.substring(0, 47) + '...'
    : productTitle;

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
        {/* 左側：サムネイル画像 */}
        <div
          style={{
            width: '400px',
            height: '550px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '40px',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#2a2a4a',
          }}
        >
          {productImage ? (
            <img
              src={productImage}
              alt={productTitle}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 48,
                color: '#6b7280',
                display: 'flex',
              }}
            >
              🎬
            </div>
          )}
        </div>

        {/* 右側：商品情報 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* プロバイダーバッジ */}
          {providerName && (
            <div
              style={{
                display: 'flex',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(90deg, #e91e63, #9c27b0)',
                  color: 'white',
                  padding: '8px 20px',
                  borderRadius: '20px',
                  fontSize: 24,
                  fontWeight: 'bold',
                }}
              >
                {providerName}
              </span>
            </div>
          )}

          {/* タイトル */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 'bold',
              color: 'white',
              lineHeight: 1.3,
              marginBottom: '24px',
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            {displayTitle}
          </div>

          {/* 価格 */}
          {price && price > 0 && (
            <div
              style={{
                fontSize: 40,
                color: '#4ade80',
                fontWeight: 'bold',
                marginBottom: '24px',
                display: 'flex',
              }}
            >
              ¥{price.toLocaleString()}
            </div>
          )}

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
