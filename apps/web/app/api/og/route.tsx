/**
 * OG画像動的生成API
 *
 * 女優・商品ページ用のOG画像を動的に生成
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// OG画像サイズ
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// サイト名
const SITE_NAME = 'AV情報まとめ';

interface OgParams {
  type: 'actress' | 'product';
  title: string;
  subtitle?: string;
  imageUrl?: string;
}

function parseParams(request: NextRequest): OgParams | null {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get('type') as 'actress' | 'product' | null;
  const title = searchParams.get('title');

  if (!type || !title) {
    return null;
  }

  return {
    type,
    title: decodeURIComponent(title),
    subtitle: searchParams.get('subtitle')
      ? decodeURIComponent(searchParams.get('subtitle')!)
      : undefined,
    imageUrl: searchParams.get('image')
      ? decodeURIComponent(searchParams.get('image')!)
      : undefined,
  };
}

export async function GET(request: NextRequest) {
  const params = parseParams(request);

  if (!params) {
    return new Response('Missing required parameters: type, title', {
      status: 400,
    });
  }

  const { type, title, subtitle, imageUrl } = params;

  // 背景グラデーション色
  const gradientColors =
    type === 'actress'
      ? ['#FF6B6B', '#FF8E53'] // 女優: ピンク系
      : ['#667eea', '#764ba2']; // 商品: パープル系

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: `linear-gradient(135deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`,
          padding: '40px',
        }}
      >
        {/* メインコンテンツエリア */}
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '48px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* 画像エリア（左側） */}
          {imageUrl && (
            <div
              style={{
                width: '280px',
                height: '100%',
                display: 'flex',
                flexShrink: 0,
                marginRight: '48px',
              }}
            >
              <img
                src={imageUrl}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '16px',
                }}
              />
            </div>
          )}

          {/* テキストエリア（右側） */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {/* タイプラベル */}
            <div
              style={{
                display: 'flex',
                marginBottom: '16px',
              }}
            >
              <span
                style={{
                  backgroundColor: gradientColors[0],
                  color: 'white',
                  padding: '8px 20px',
                  borderRadius: '20px',
                  fontSize: '20px',
                  fontWeight: 'bold',
                }}
              >
                {type === 'actress' ? '女優情報' : '作品情報'}
              </span>
            </div>

            {/* タイトル */}
            <h1
              style={{
                fontSize: title.length > 20 ? '48px' : '56px',
                fontWeight: 'bold',
                color: '#1a1a1a',
                lineHeight: 1.2,
                margin: '0 0 16px 0',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {title}
            </h1>

            {/* サブタイトル */}
            {subtitle && (
              <p
                style={{
                  fontSize: '28px',
                  color: '#666',
                  margin: '0 0 24px 0',
                  lineHeight: 1.4,
                }}
              >
                {subtitle}
              </p>
            )}

            {/* サイト名 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: 'auto',
              }}
            >
              <span
                style={{
                  fontSize: '24px',
                  color: '#999',
                  fontWeight: 500,
                }}
              >
                {SITE_NAME}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
    }
  );
}
