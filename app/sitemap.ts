import { MetadataRoute } from 'next';
import { getActresses } from '@/lib/db/queries';
import { getProducts } from '@/lib/db/queries';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

// 動的生成（DBから毎回取得）
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // データベースから女優と商品を取得
  let actresses: Awaited<ReturnType<typeof getActresses>> = [];
  let dbProducts: Awaited<ReturnType<typeof getProducts>> = [];

  try {
    [actresses, dbProducts] = await Promise.all([
      getActresses(),
      getProducts({ limit: 10000 }), // 最大10000件まで
    ]);
  } catch (error) {
    console.error('Error fetching data for sitemap:', error);
    // DBエラーの場合は静的ページのみ返す
  }

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/actresses`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/featured`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/new`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // 女優ページ
  const actressPages: MetadataRoute.Sitemap = actresses.map((actress) => ({
    url: `${siteUrl}/actress/${actress.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // 商品ページ（データベースから取得、最大1000件まで）
  // 全ての商品を含めるとファイルが大きくなりすぎるため制限
  const productPages: MetadataRoute.Sitemap = dbProducts.slice(0, 1000).map((product) => ({
    url: `${siteUrl}/product/${product.id}`,
    lastModified: product.releaseDate ? new Date(product.releaseDate) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...actressPages, ...productPages];
}


