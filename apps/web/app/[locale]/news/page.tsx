import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getNewsByCategory } from '@/lib/db/news-queries';
import { generateBaseMetadata } from '@/lib/seo';
import { localizedHref } from '@adult-v/shared/i18n';
import Breadcrumb from '@/components/Breadcrumb';
import { Newspaper, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { unstable_cache } from 'next/cache';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  try {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'news' });
    const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

    const metadata = generateBaseMetadata(
      t('title'),
      t('metaDescription'),
      undefined,
      localizedHref('/news', locale),
      undefined,
      locale,
    );

    return {
      ...metadata,
      alternates: {
        canonical: `${baseUrl}/news`,
        languages: {
          'ja': `${baseUrl}/news`,
          'en': `${baseUrl}/news?hl=en`,
          'zh': `${baseUrl}/news?hl=zh`,
          'zh-TW': `${baseUrl}/news?hl=zh-TW`,
          'ko': `${baseUrl}/news?hl=ko`,
          'x-default': `${baseUrl}/news`,
        },
      },
    };
  } catch {
    return {};
  }
}

// getTranslationsがheaders()を呼ぶためISR(revalidate)は無効 → force-dynamic
export const dynamic = 'force-dynamic';

// DB query cache (600秒)
const getCachedNews = unstable_cache(
  async (category: string | null, page: number, limit: number) => {
    return getNewsByCategory(category, page, limit);
  },
  ['news-list'],
  { revalidate: 600, tags: ['news'] }
);

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'news' });
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const category = sp.category || null;
  const page = parseInt(sp.page || '1');
  const limit = 20;

  const { articles, total } = await getCachedNews(category, page, limit);
  const totalPages = Math.ceil(total / limit);

  const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    new_releases: { bg: 'bg-blue-600', text: 'text-blue-100', label: t('newReleases') },
    sales: { bg: 'bg-red-600', text: 'text-red-100', label: t('sales') },
    ai_analysis: { bg: 'bg-purple-600', text: 'text-purple-100', label: t('aiAnalysis') },
    industry: { bg: 'bg-green-600', text: 'text-green-100', label: t('industry') },
    site_update: { bg: 'bg-gray-600', text: 'text-gray-100', label: t('siteUpdate') },
  };

  const CATEGORIES = [
    { key: null, label: t('allCategories') },
    { key: 'new_releases', label: t('newReleases') },
    { key: 'sales', label: t('sales') },
    { key: 'ai_analysis', label: t('aiAnalysis') },
    { key: 'site_update', label: t('siteUpdate') },
  ];

  return (
    <div className="min-h-screen theme-body">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumb
          items={[
            { label: tNav('home'), href: localizedHref('/', locale) },
            { label: t('title') },
          ]}
          className="mb-4"
        />

        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <Newspaper className="w-7 h-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="text-sm text-gray-400">{t('metaDescription')}</p>
          </div>
        </div>

        {/* カテゴリフィルタ */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => {
            const isActive = category === cat.key;
            const href = cat.key
              ? localizedHref(`/news?category=${cat.key}`, locale)
              : localizedHref('/news', locale);

            return (
              <a
                key={cat.key || 'all'}
                href={href}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {cat.label}
              </a>
            );
          })}
        </div>

        {/* 記事一覧 */}
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400">{t('noArticles')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => {
              const style = CATEGORY_STYLES[article.category] || CATEGORY_STYLES['site_update'];
              const publishedDate = new Date(article.published_at).toLocaleDateString(
                locale === 'ko' ? 'ko-KR' : locale === 'zh-TW' ? 'zh-TW' : locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP',
                { year: 'numeric', month: 'long', day: 'numeric' },
              );

              return (
                <a
                  key={article.id}
                  href={localizedHref(`/news/${article.slug}`, locale)}
                  className={`block p-4 rounded-xl transition-colors ${
                    article.featured
                      ? 'bg-gradient-to-r from-gray-800 to-gray-800/60 border border-yellow-600/30 hover:border-yellow-500/50'
                      : 'bg-gray-800 hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="text-xs text-gray-400">{publishedDate}</span>
                        {article.featured && (
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        )}
                      </div>
                      <h2 className="text-lg font-semibold text-white mb-1">
                        {article.title}
                      </h2>
                      {article.excerpt && (
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {article.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {page > 1 && (
              <a
                href={localizedHref(`/news?${category ? `category=${category}&` : ''}page=${page - 1}`, locale)}
                className="flex items-center gap-1 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </a>
            )}
            <span className="px-4 py-2 text-sm text-gray-400">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={localizedHref(`/news?${category ? `category=${category}&` : ''}page=${page + 1}`, locale)}
                className="flex items-center gap-1 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
