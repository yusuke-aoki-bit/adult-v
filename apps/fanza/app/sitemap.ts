import { MetadataRoute } from 'next';
import { getDb } from '@/lib/db';
import { products, performers, tags, productTags } from '@/lib/db/schema';
import { desc, sql, eq, isNotNull } from 'drizzle-orm';

// サイトマップ設定 - インデックス対象件数
const SITEMAP_CONFIG = {
  products: 10000,    // 5000 → 10000に拡大
  performers: 2000,   // 1000 → 2000に拡大
  tags: 1000,         // 500 → 1000に拡大
  makers: 500,        // 新規追加
  series: 1000,       // 新規追加
};

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

// Force dynamic generation - do not prerender at build time
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

// hreflang用の言語バリエーションを生成（?hl=パラメータ方式）
// middlewareが/ja/, /en/などのプレフィックスを?hl=形式に301リダイレクトするため統一
// 例: /products/123 → { ja: /products/123, en: /products/123?hl=en, ... }
function getLanguageAlternates(basePath: string) {
  // basePath が空の場合（ルートページ）は / として扱う
  const path = basePath === '/' ? '' : basePath;
  return {
    ja: `${BASE_URL}${path || '/'}`,
    en: `${BASE_URL}${path || '/'}?hl=en`,
    zh: `${BASE_URL}${path || '/'}?hl=zh`,
    'zh-TW': `${BASE_URL}${path || '/'}?hl=zh-TW`,
    ko: `${BASE_URL}${path || '/'}?hl=ko`,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages with high priority and daily updates
  // canonical URLはパラメータなし（日本語デフォルト）、alternatesで各言語を指定
  const staticPages: MetadataRoute.Sitemap = [
    // Home page - canonical URL is / (Japanese default)
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
      alternates: {
        languages: getLanguageAlternates('/'),
      },
    },
    // Products pages
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
      alternates: {
        languages: getLanguageAlternates('/products'),
      },
    },
    // Categories pages
    {
      url: `${BASE_URL}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
      alternates: {
        languages: getLanguageAlternates('/categories'),
      },
    },
    // Privacy policy page (Japanese only)
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date('2024-12-09'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    // Terms of service page (Japanese only)
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date('2024-12-09'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
  ];

  // If DATABASE_URL is not available (during build), return static pages only
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not available - generating sitemap with static pages only');
    return staticPages;
  }

  try {
    const db = getDb();

    // Recent products - SEO priority for content pages
    const recentProducts = await db
      .select({
        id: products.id,
        normalizedProductId: products.normalizedProductId,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .orderBy(desc(products.releaseDate))
      .limit(SITEMAP_CONFIG.products);

    // 商品ページ - 数値IDと品番の両方をsitemapに含める
    const productPages: MetadataRoute.Sitemap = recentProducts.flatMap((product) => {
      const pages: MetadataRoute.Sitemap = [
        {
          url: `${BASE_URL}/products/${product.id}`,
          lastModified: product.updatedAt || new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
          alternates: {
            languages: getLanguageAlternates(`/products/${product.id}`),
          },
        },
      ];

      if (product.normalizedProductId && product.normalizedProductId !== String(product.id)) {
        pages.push({
          url: `${BASE_URL}/products/${product.normalizedProductId}`,
          lastModified: product.updatedAt || new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
          alternates: {
            languages: getLanguageAlternates(`/products/${product.normalizedProductId}`),
          },
        });
      }

      return pages;
    });

    // Top performers - Prioritize performers with most products
    const topPerformers = await db
      .select({
        id: performers.id,
        productCount: sql<number>`COUNT(DISTINCT pp.product_id)`.as('product_count'),
      })
      .from(performers)
      .leftJoin(
        sql`product_performers pp`,
        sql`${performers.id} = pp.performer_id`
      )
      .groupBy(performers.id)
      .orderBy(desc(sql`product_count`))
      .limit(SITEMAP_CONFIG.performers);

    // 女優ページ - GSC data shows actress pages get most clicks
    const performerPages: MetadataRoute.Sitemap = topPerformers.map((performer) => ({
      url: `${BASE_URL}/actress/${performer.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      alternates: {
        languages: getLanguageAlternates(`/actress/${performer.id}`),
      },
    }));

    // Top tags/genres - Prioritize tags with most products
    const topTags = await db
      .select({
        id: tags.id,
        productCount: sql<number>`COUNT(DISTINCT ${productTags.productId})`.as('product_count'),
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .where(eq(tags.category, 'genre'))
      .groupBy(tags.id)
      .orderBy(desc(sql`product_count`))
      .limit(SITEMAP_CONFIG.tags);

    const tagPages: MetadataRoute.Sitemap = topTags.map((tag) => ({
      url: `${BASE_URL}/tags/${tag.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
      alternates: {
        languages: getLanguageAlternates(`/tags/${tag.id}`),
      },
    }));

    // Top makers - メーカー別ページ
    const topMakers = await db
      .select({
        makerId: products.makerId,
        productCount: sql<number>`COUNT(DISTINCT ${products.id})`.as('product_count'),
      })
      .from(products)
      .where(isNotNull(products.makerId))
      .groupBy(products.makerId)
      .orderBy(desc(sql`product_count`))
      .limit(SITEMAP_CONFIG.makers);

    const makerPages: MetadataRoute.Sitemap = topMakers
      .filter(maker => maker.makerId)
      .map((maker) => ({
        url: `${BASE_URL}/makers/${maker.makerId}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
        alternates: {
          languages: getLanguageAlternates(`/makers/${maker.makerId}`),
        },
      }));

    // Top series - シリーズページ
    const topSeries = await db
      .select({
        id: tags.id,
        productCount: sql<number>`COUNT(DISTINCT ${productTags.productId})`.as('product_count'),
      })
      .from(tags)
      .leftJoin(productTags, eq(tags.id, productTags.tagId))
      .where(eq(tags.category, 'series'))
      .groupBy(tags.id)
      .orderBy(desc(sql`product_count`))
      .limit(SITEMAP_CONFIG.series);

    const seriesPages: MetadataRoute.Sitemap = topSeries.map((series) => ({
      url: `${BASE_URL}/series/${series.id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
      alternates: {
        languages: getLanguageAlternates(`/series/${series.id}`),
      },
    }));

    return [...staticPages, ...productPages, ...performerPages, ...tagPages, ...makerPages, ...seriesPages];
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return static pages only on error
    return staticPages;
  }
}
