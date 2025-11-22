import { MetadataRoute } from 'next';
import { getActresses } from '@/lib/db/queries';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
const locales = ['ja', 'en', 'zh'];

// 動的生成(DBから毎回取得)
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // データベースから女優と商品を取得
  let actresses: Awaited<ReturnType<typeof getActresses>> = [];
  let dbProducts: any[] = [];

  try {
    [actresses, dbProducts] = await Promise.all([
      getActresses({ limit: 5000 }),
      db.select().from(products).orderBy(desc(products.createdAt)).limit(5000),
    ]);
  } catch (error) {
    console.error('Error fetching data for sitemap:', error);
    // DBエラーの場合は静的ページのみ返す
  }

  const sitemapEntries: MetadataRoute.Sitemap = [];

  // 各ロケールのホームページ
  locales.forEach((locale) => {
    sitemapEntries.push({
      url: `${siteUrl}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${siteUrl}/${l}`])
        ),
      },
    });

    // 検索ページ
    sitemapEntries.push({
      url: `${siteUrl}/${locale}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    });

    // お気に入りページ
    sitemapEntries.push({
      url: `${siteUrl}/${locale}/favorites`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  });

  // 女優ページ（各ロケール）
  actresses.forEach((actress) => {
    locales.forEach((locale) => {
      sitemapEntries.push({
        url: `${siteUrl}/${locale}/actress/${actress.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [`${l}`, `${siteUrl}/${l}/actress/${actress.id}`])
          ),
        },
      });
    });
  });

  // 商品ページ（最大5000件、日本語のみ）
  dbProducts.forEach((product) => {
    sitemapEntries.push({
      url: `${siteUrl}/ja/products/${product.id}`,
      lastModified: product.createdAt ? new Date(product.createdAt) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  });

  return sitemapEntries;
}
