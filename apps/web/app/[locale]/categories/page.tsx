import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { generateBaseMetadata, generateBreadcrumbSchema, generateCollectionPageSchema, generateFAQSchema, getCategoryPageFAQs, generateItemListSchema } from '@/lib/seo';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { getPopularTags } from '@/lib/db/queries';
import { localizedHref } from '@adult-v/shared/i18n';

// カテゴリ一覧は変更頻度が低いためISRで1時間キャッシュ
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('categories');
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

  const metadata = generateBaseMetadata(
    t('metaTitle'),
    t('metaDescription'),
    undefined,
    `/${locale}/categories`,
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

  // 人気タグを取得（上位100件）
  const tags = await getPopularTags({ limit: 100, category: selectedCategory });

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
    <>
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

      <div className="container mx-auto px-4 py-8">
        <Breadcrumb
          items={breadcrumbItems.map((item) => ({
            label: item.name,
            href: item.url,
          }))}
        />

        <h1 className="text-3xl font-bold text-white mb-4">{t('title')}</h1>
        <p className="text-gray-400 mb-8">{t('description')}</p>

        {/* カテゴリフィルター */}
        <div className="flex flex-wrap gap-2 mb-8">
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
    </>
  );
}
