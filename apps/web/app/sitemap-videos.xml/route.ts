import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { products, productVideos } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';
const MAX_VIDEOS = 10000;

export const revalidate = 3600; // 1時間キャッシュ

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 動画サイトマップ - Google Video Search最適化
 * product_videosテーブルからサンプル動画を取得し、Video Sitemap形式で出力
 */
export async function GET() {
  if (!process.env['DATABASE_URL']) {
    return new NextResponse('Database not configured', { status: 500 });
  }

  try {
    const db = getDb();

    const videosWithProducts = await db
      .select({
        productId: products.id,
        title: products.title,
        description: products.description,
        thumbnailUrl: products.defaultThumbnailUrl,
        releaseDate: products.releaseDate,
        duration: products.duration,
        videoUrl: productVideos.videoUrl,
        videoDuration: productVideos.duration,
      })
      .from(productVideos)
      .innerJoin(products, eq(productVideos.productId, products.id))
      .where(eq(productVideos.videoType, 'sample'))
      .orderBy(desc(products.releaseDate))
      .limit(MAX_VIDEOS);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${videosWithProducts
  .map((v) => {
    const productUrl = `${BASE_URL}/products/${v.productId}`;
    const title = escapeXml(v.title || '');
    const description = escapeXml((v.description || v.title || '').substring(0, 2048));
    const thumbnailLoc = v.thumbnailUrl ? escapeXml(v.thumbnailUrl) : '';
    const contentLoc = escapeXml(v.videoUrl);
    // duration: product_videos.duration is in seconds, products.duration is in minutes
    const durationSeconds = v.videoDuration || (v.duration ? v.duration * 60 : null);
    const uploadDate = v.releaseDate ? new Date(v.releaseDate).toISOString().split('T')[0] : '';

    return `  <url>
    <loc>${productUrl}</loc>
    <video:video>
      <video:title>${title}</video:title>
      <video:description>${description}</video:description>${
        thumbnailLoc
          ? `
      <video:thumbnail_loc>${thumbnailLoc}</video:thumbnail_loc>`
          : ''
      }
      <video:content_loc>${contentLoc}</video:content_loc>${
        durationSeconds
          ? `
      <video:duration>${durationSeconds}</video:duration>`
          : ''
      }${
        uploadDate
          ? `
      <video:publication_date>${uploadDate}</video:publication_date>`
          : ''
      }
      <video:family_friendly>no</video:family_friendly>
    </video:video>
  </url>`;
  })
  .join('\n')}
</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error generating video sitemap:', error);
    return new NextResponse('Error generating video sitemap', { status: 500 });
  }
}
