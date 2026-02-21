import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { generateBaseMetadata, generateBreadcrumbSchema, generateCollectionPageSchema, generateFAQSchema, getCategoryPageFAQs, generateItemListSchema } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getPopularTags } from '@/lib/db/queries';
import { localizedHref } from '@adult-v/shared/i18n';
import { unstable_cache } from 'next/cache';

// getTranslationsがheaders()を呼ぶためISR(revalidate)は無効 → force-dynamic
export const dynamic = 'force-dynamic';

// DB query cache (3600秒)
const getCachedPopularTags = unstable_cache(
  async (options: { limit: number; category?: string }) => {
    return getPopularTags(options);
  },
  ['categories-popular-tags'],
  { revalidate: 3600, tags: ['categories'] }
);

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations('categories');
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  // カテゴリフィルターがある場合はnoindex（重複ページ対策）
  if (resolvedSearchParams.category) {
    return {
      title: t('metaTitle'),
      description: t('metaDescription'),
      robots: { index: false, follow: true },
      alternates: {
        canonical: `${baseUrl}/categories`,
      },
    };
  }

  const metadata = generateBaseMetadata(
    t('metaTitle'),
    t('metaDescription'),
    undefined,
    localizedHref('/categories', locale),
    undefined,
    locale,
  );

  return {
    ...metadata,
    alternates: {
      canonical: `${baseUrl}/categories`,
      languages: {
        'ja': `${baseUrl}/categories`,
        'en': `${baseUrl}/categories?hl=en`,
        'zh': `${baseUrl}/categories?hl=zh`,
        'zh-TW': `${baseUrl}/categories?hl=zh-TW`,
        'ko': `${baseUrl}/categories?hl=ko`,
        'x-default': `${baseUrl}/categories`,
      },
    },
  };
}

export default async function CategoriesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const selectedCategory = resolvedSearchParams.category;
  const t = await getTranslations('categories');
  const tCommon = await getTranslations('common');
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  // 人気タグを取得（exactOptionalPropertyTypes対応）
  const tagsOptions = { limit: 100, ...(selectedCategory && { category: selectedCategory }) };
  const tags = await getCachedPopularTags(tagsOptions);

  // カテゴリ別にグループ化
  const tagsByCategory = tags.reduce((acc, tag) => {
    const cat = tag.category || 'other';
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(tag);
    return acc;
  }, {} as Record<string, typeof tags>);

  // カテゴリの表示順序
  const categoryOrder = ['genre', 'situation', 'play', 'body', 'costume', 'other'];
  const categoryLabels: Record<string, string> = {
    genre: t('popularGenres'),
    situation: t('situationGenres'),
    play: t('playGenres'),
    body: t('bodyTypeGenres'),
    costume: t('costumeGenres'),
    other: t('otherGenres'),
  };

  // パンくずリスト（?hl=形式のURL）
  const breadcrumbItems = [
    { name: tCommon('products'), url: localizedHref('/', locale) },
    { name: t('title'), url: localizedHref('/categories', locale) },
  ];

  // カテゴリページ用FAQ
  const categoryFAQs = getCategoryPageFAQs(locale);

  // ItemListSchema用のタグデータ（上位30件）
  const itemListData = tags.slice(0, 30).map((tag) => ({
    name: tag.name,
    url: localizedHref(`/products?include=${tag.id}`, locale),
  }));

  return (
    <div className="theme-body min-h-screen">
      <JsonLD
        data={[
          generateBreadcrumbSchema(breadcrumbItems),
          generateCollectionPageSchema(
            t('title'),
            t('metaDescription'),
            localizedHref('/categories', locale),
            locale,
          ),
          generateFAQSchema(categoryFAQs),
          generateItemListSchema(itemListData, t('title')),
        ]}
      />

      <section id="categories" className="py-3 sm:py-4 md:py-6 scroll-mt-20">
        <div className="container mx-auto px-3 sm:px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: t('title') },
            ]}
            className="mb-2 sm:mb-3"
          />

          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400 mb-6">{t('description')}</p>

          {/* カテゴリフィルター */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Link
              href={localizedHref('/categories', locale)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                !selectedCategory
                  ? 'bg-rose-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t('allCategories')}
            </Link>
            {categoryOrder.map((cat) => (
              <Link
                key={cat}
                href={localizedHref(`/categories?category=${cat}`, locale)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-rose-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {categoryLabels[cat]}
              </Link>
            ))}
          </div>

          {tags.length === 0 ? (
            <p className="text-gray-400 text-center py-12">{t('noCategories')}</p>
          ) : selectedCategory ? (
            // 特定カテゴリのみ表示
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={localizedHref(`/products?include=${tag.id}`, locale)}
                  className="group bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors"
                >
                  <h3 className="text-white font-medium group-hover:text-rose-400 transition-colors mb-1">
                    {tag.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {t('productCount', { count: tag.count })}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            // カテゴリ別に表示
            <div className="space-y-8">
              {categoryOrder.map((cat) => {
                const catTags = tagsByCategory[cat];
                if (!catTags || catTags.length === 0) return null;

                return (
                  <section key={cat}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-white">{categoryLabels[cat]}</h2>
                      <Link
                        href={localizedHref(`/categories?category=${cat}`, locale)}
                        className="text-sm text-rose-400 hover:text-rose-300"
                      >
                        {t('viewProducts')} →
                      </Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {catTags.slice(0, 12).map((tag) => (
                        <Link
                          key={tag.id}
                          href={localizedHref(`/products?include=${tag.id}`, locale)}
                          className="group bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors"
                        >
                          <h3 className="text-white text-sm font-medium group-hover:text-rose-400 transition-colors truncate">
                            {tag.name}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {t('productCount', { count: tag.count })}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
