import { NextResponse } from 'next/server';

const BASE_URL = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://f.adult-v.com';

/**
 * 女優ページのサイトマップ（レガシー）
 * sitemap-actresses-[chunk].xml に移行済み
 * このエンドポイントはチャンク版サイトマップインデックスへリダイレクト
 */
export async function GET() {
  // チャンク版サイトマップを使用するよう、サイトマップインデックスにリダイレクト
  // 旧URLにアクセスがあった場合の後方互換性を維持
  return NextResponse.redirect(`${BASE_URL}/sitemap.xml`, 301);
}

export const revalidate = 3600; // 1時間キャッシュ
