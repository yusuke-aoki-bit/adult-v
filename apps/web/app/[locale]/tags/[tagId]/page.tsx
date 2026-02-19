import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import ProductCard from '@/components/ProductCard';
import { SocialShareButtons } from '@adult-v/shared/components';
import Pagination from '@/components/Pagination';
import { getTagById, getProducts, getProductsCount, getPopularTags } from '@/lib/db/queries';
import { generateBaseMetadata, generateBreadcrumbSchema, generateCollectionPageSchema, generateItemListSchema, generateFAQSchema } from '@/lib/seo';
import { localizedHref } from '@adult-v/shared/i18n';

export const revalidate = 3600; // 1時間キャッシュ

interface PageProps {
  params: Promise<{ tagId: string; locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  try {
    const { tagId, locale } = await params;
    const resolvedSearchParams = await searchParams;
    const tagIdNum = parseInt(tagId, 10);

    if (isNaN(tagIdNum)) {
      return { title: 'タグが見つかりません' };
    }

    const tag = await getTagById(tagIdNum);
    if (!tag) {
      return { title: 'タグが見つかりません' };
    }

    const tagName = locale === 'en' && tag.nameEn ? tag.nameEn :
      locale === 'zh' && tag.nameZh ? tag.nameZh :
        locale === 'ko' && tag.nameKo ? tag.nameKo :
          tag.name;

    const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';
    const title = `${tagName}の動画一覧 | Adult Viewer Lab`;
    const description = `${tagName}ジャンルの人気作品を厳選。高評価・セール中の作品も多数掲載。${tagName}好きにおすすめの動画を探すならAdult Viewer Lab。`;

    // ページネーションがある場合はnoindex（重複ページ対策）
    const hasPageParam = resolvedSearchParams.page && resolvedSearchParams.page !== '1';
    if (hasPageParam) {
      return {
        title,
        description,
        robots: { index: false, follow: true },
        alternates: {
          canonical: `${baseUrl}/tags/${tagId}`,
        },
      };
    }

    const metadata = generateBaseMetadata(
      title,
      description,
      undefined,
      localizedHref(`/tags/${tagId}`, locale),
      undefined,
      locale,
    );

    return {
      ...metadata,
      alternates: {
        canonical: `${baseUrl}/tags/${tagId}`,
        languages: {
          'ja': `${baseUrl}/tags/${tagId}`,
          'en': `${baseUrl}/tags/${tagId}?hl=en`,
          'zh': `${baseUrl}/tags/${tagId}?hl=zh`,
          'zh-TW': `${baseUrl}/tags/${tagId}?hl=zh-TW`,
          'ko': `${baseUrl}/tags/${tagId}?hl=ko`,
          'x-default': `${baseUrl}/tags/${tagId}`,
        },
      },
    };
  } catch {
    return {};
  }
}

export default async function TagPage({ params, searchParams }: PageProps) {
  const { tagId, locale } = await params;
  const resolvedSearchParams = await searchParams;
  const tagIdNum = parseInt(tagId, 10);

  if (isNaN(tagIdNum)) {
    notFound();
  }

  const tag = await getTagById(tagIdNum);
  if (!tag) {
    notFound();
  }

  const t = await getTranslations('categories');
  const tCommon = await getTranslations('common');
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  const tagName = locale === 'en' && tag.nameEn ? tag.nameEn :
    locale === 'zh' && tag.nameZh ? tag.nameZh :
      locale === 'ko' && tag.nameKo ? tag.nameKo :
        tag.name;

  const page = Math.max(1, Math.min(parseInt(resolvedSearchParams.page || '1', 10), 500));
  const perPage = 24;
  const offset = (page - 1) * perPage;

  // 商品を取得
  const [products, totalCount] = await Promise.all([
    getProducts({
      tags: [String(tagIdNum)],
      limit: perPage,
      offset,
      sortBy: 'releaseDateDesc',
      locale,
    }),
    getProductsCount({ tags: [String(tagIdNum)] }),
  ]);

  const totalPages = Math.ceil(totalCount / perPage);

  // 関連タグを取得（同じカテゴリの人気タグ）
  const relatedTags = await getPopularTags({
    category: tag.category || undefined,
    limit: 12,
  });
  const filteredRelatedTags = relatedTags.filter(t => t.id !== tagIdNum);

  // パンくずリスト
  const breadcrumbItems = [
    { name: tCommon('products'), url: localizedHref('/', locale) },
    { name: t('title'), url: localizedHref('/categories', locale) },
    { name: tagName, url: localizedHref(`/tags/${tagId}`, locale) },
  ];

  // FAQ生成
  const faqs = [
    {
      question: `${tagName}とは何ですか？`,
      answer: `${tagName}は、アダルトビデオのジャンル・カテゴリの一つです。このジャンルに該当する作品を当サイトでは${totalCount.toLocaleString()}件以上掲載しています。`,
    },
    {
      question: `${tagName}の人気作品は？`,
      answer: `${tagName}ジャンルでは、高評価の作品やセール中の作品が人気です。当ページでは新作順に表示していますが、評価順やセール順でも並び替えが可能です。`,
    },
  ];

  // ItemListSchema用のデータ
  const itemListData = products.slice(0, 10).map((product) => ({
    name: product.title,
    url: localizedHref(`/products/${product.normalizedProductId || product.id}`, locale),
    image: product.imageUrl,
  }));

  return (
    <div className="theme-body min-h-screen">
      <JsonLD
        data={[
          generateBreadcrumbSchema(breadcrumbItems),
          generateCollectionPageSchema(
            `${tagName}の動画一覧`,
            `${tagName}ジャンルの人気作品一覧`,
            localizedHref(`/tags/${tagId}`, locale),
            locale,
          ),
          generateItemListSchema(itemListData, `${tagName}の動画`),
          generateFAQSchema(faqs),
        ]}
      />

      <section className="py-3 sm:py-4 md:py-6 scroll-mt-20">
        <div className="container mx-auto px-3 sm:px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: t('title'), href: localizedHref('/categories', locale) },
              { label: tagName },
            ]}
            className="mb-2 sm:mb-3"
          />

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
                {tagName}
              </h1>
              <p className="text-gray-400">
                {totalCount.toLocaleString()}件の作品
                {tag.category && (
                  <span className="ml-2 px-2 py-0.5 bg-gray-700 rounded text-xs">
                    {tag.category === 'genre' && 'ジャンル'}
                    {tag.category === 'situation' && 'シチュエーション'}
                    {tag.category === 'play' && 'プレイ'}
                    {tag.category === 'body' && '体型'}
                    {tag.category === 'costume' && '衣装'}
                  </span>
                )}
              </p>
            </div>
            <SocialShareButtons
              title={`${tagName}の動画一覧`}
              compact
              hashtags={[tagName.replace(/\s/g, '')]}
            />
          </div>

          {/* 関連タグ */}
          {filteredRelatedTags.length > 0 && (
            <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">
                関連ジャンル
              </h2>
              <div className="flex flex-wrap gap-2">
                {filteredRelatedTags.map((relatedTag) => (
                  <Link
                    key={relatedTag.id}
                    href={localizedHref(`/tags/${relatedTag.id}`, locale)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-full text-sm transition-colors"
                  >
                    {relatedTag.name}
                    <span className="ml-1 text-gray-400 text-xs">
                      ({relatedTag.count.toLocaleString()})
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 商品一覧 */}
          {products.length === 0 ? (
            <p className="text-gray-400 text-center py-12">
              このジャンルの作品はまだありません
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={index < 6}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8">
                  <Pagination
                    total={totalCount}
                    page={page}
                    perPage={perPage}
                    basePath={localizedHref(`/tags/${tagId}`, locale)}
                  />
                </div>
              )}
            </>
          )}

          {/* カテゴリ一覧へのリンク */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <Link
              href={localizedHref('/categories', locale)}
              className="inline-flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              全カテゴリ一覧へ
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
