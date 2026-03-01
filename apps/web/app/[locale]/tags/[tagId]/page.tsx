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
import {
  generateBaseMetadata,
  generateBreadcrumbSchema,
  generateCollectionPageSchema,
  generateItemListSchema,
  generateFAQSchema,
} from '@/lib/seo';
import { localizedHref } from '@adult-v/shared/i18n';

// ISR: locale明示でheaders()回避済み → パブリックキャッシュ有効
export const revalidate = 60;

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

    const tagName =
      locale === 'en' && tag.nameEn
        ? tag.nameEn
        : locale === 'zh' && tag.nameZh
          ? tag.nameZh
          : locale === 'ko' && tag.nameKo
            ? tag.nameKo
            : tag.name;

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
          ja: `${baseUrl}/tags/${tagId}`,
          en: `${baseUrl}/tags/${tagId}?hl=en`,
          zh: `${baseUrl}/tags/${tagId}?hl=zh`,
          'zh-TW': `${baseUrl}/tags/${tagId}?hl=zh-TW`,
          ko: `${baseUrl}/tags/${tagId}?hl=ko`,
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

  let tag, t, tCommon, tNav;
  try {
    [tag, t, tCommon, tNav] = await Promise.all([
      getTagById(tagIdNum),
      getTranslations({ locale, namespace: 'categories' }),
      getTranslations({ locale, namespace: 'common' }),
      getTranslations({ locale, namespace: 'nav' }),
    ]);
  } catch (error) {
    console.error(`[tag-detail] Error loading tag ${tagId}:`, error);
    notFound();
  }
  if (!tag) {
    notFound();
  }

  const tagName =
    locale === 'en' && tag.nameEn
      ? tag.nameEn
      : locale === 'zh' && tag.nameZh
        ? tag.nameZh
        : locale === 'ko' && tag.nameKo
          ? tag.nameKo
          : tag.name;

  const page = Math.max(1, Math.min(parseInt(resolvedSearchParams.page || '1', 10), 500));
  const perPage = 24;
  const offset = (page - 1) * perPage;

  let products, totalCount, relatedTags;
  try {
    // 商品を取得
    [products, totalCount, relatedTags] = await Promise.all([
      getProducts({
        tags: [String(tagIdNum)],
        limit: perPage,
        offset,
        sortBy: 'releaseDateDesc',
        locale,
      }),
      getProductsCount({ tags: [String(tagIdNum)] }),
      getPopularTags({
        category: tag.category || undefined,
        limit: 12,
      }),
    ]);
  } catch (error) {
    console.error(`[tag-detail] Error loading products for tag ${tagId}:`, error);
    notFound();
  }

  const totalPages = Math.ceil(totalCount / perPage);
  const filteredRelatedTags = relatedTags.filter((rt: (typeof relatedTags)[number]) => rt.id !== tagIdNum);

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

      <section className="scroll-mt-20 py-3 sm:py-4 md:py-6">
        <div className="container mx-auto px-3 sm:px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: t('title'), href: localizedHref('/categories', locale) },
              { label: tagName },
            ]}
            className="mb-2 sm:mb-3"
          />

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="mb-2 text-xl font-bold text-white sm:text-2xl md:text-3xl">{tagName}</h1>
              <p className="text-gray-400">
                {totalCount.toLocaleString()}件の作品
                {tag.category && (
                  <span className="ml-2 rounded bg-gray-700 px-2 py-0.5 text-xs">
                    {tag.category === 'genre' && 'ジャンル'}
                    {tag.category === 'situation' && 'シチュエーション'}
                    {tag.category === 'play' && 'プレイ'}
                    {tag.category === 'body' && '体型'}
                    {tag.category === 'costume' && '衣装'}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 sm:text-sm">
                {locale === 'en'
                  ? `Browse ${totalCount.toLocaleString()} ${tagName} videos. Find the best ${tagName} titles with free sample videos, sale prices, and cross-platform price comparison on DUGA, MGS, and more.`
                  : locale === 'zh'
                    ? `共${totalCount.toLocaleString()}部${tagName}作品。提供免费样片、特惠价格，支持DUGA・MGS等多平台价格比较。`
                    : locale === 'ko'
                      ? `${tagName} 동영상 ${totalCount.toLocaleString()}편. 무료 샘플, 할인 가격, DUGA・MGS 등 멀티 플랫폼 가격 비교를 제공합니다.`
                      : `${tagName}ジャンルのAV動画${totalCount.toLocaleString()}本を掲載。無料サンプル動画付きで、DUGA・MGS・カリビアンコム等の複数配信サイトから最安値を横断比較できます。`}
              </p>
            </div>
            <SocialShareButtons title={`${tagName}の動画一覧`} compact hashtags={[tagName.replace(/\s/g, '')]} />
          </div>

          {/* 関連タグ */}
          {filteredRelatedTags.length > 0 && (
            <div className="mb-6 rounded-lg bg-gray-800/50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-400">関連ジャンル</h2>
              <div className="flex flex-wrap gap-2">
                {filteredRelatedTags.map((relatedTag) => (
                  <Link
                    key={relatedTag.id}
                    href={localizedHref(`/tags/${relatedTag.id}`, locale)}
                    className="rounded-full bg-gray-700 px-3 py-1.5 text-sm text-gray-200 transition-colors hover:bg-gray-600"
                  >
                    {relatedTag.name}
                    <span className="ml-1 text-xs text-gray-400">({relatedTag.count.toLocaleString()})</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 商品一覧 */}
          {products.length === 0 ? (
            <p className="py-12 text-center text-gray-400">このジャンルの作品はまだありません</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {products.map((product, index) => (
                  <ProductCard key={product.id} product={product} priority={index < 6} />
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
          <div className="mt-8 border-t border-gray-700 pt-6">
            <Link
              href={localizedHref('/categories', locale)}
              className="inline-flex items-center gap-2 text-fuchsia-400 transition-colors hover:text-fuchsia-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
