import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getNewsByCategory } from '@/lib/db/news-queries';
import { generateBaseMetadata } from '@/lib/seo';
import { localizedHref } from '@adult-v/shared/i18n';
import Breadcrumb from '@/components/Breadcrumb';
import { Newspaper, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { unstable_cache } from 'next/cache';

/** Strip stale/hallucinated dates from AI-generated titles */
function sanitizeNewsTitle(title: string): string {
  const now = new Date();
  const todayStr = `${now.getMonth() + 1}月${now.getDate()}日`;
  let s = title.replace(/〇月〇日/g, todayStr);
  s = s.replace(/\(20\d{2}\/\d{1,2}\/\d{1,2}\)/g, '');
  s = s.replace(/【20\d{2}\/\d{1,2}\/\d{1,2}】/g, `【${todayStr}】`);
  return s.trim();
}

function getDateLocale(locale: string): string {
  switch (locale) {
    case 'ko':
      return 'ko-KR';
    case 'zh-TW':
      return 'zh-TW';
    case 'zh':
      return 'zh-CN';
    case 'en':
      return 'en-US';
    default:
      return 'ja-JP';
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
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
          ja: `${baseUrl}/news`,
          en: `${baseUrl}/news?hl=en`,
          zh: `${baseUrl}/news?hl=zh`,
          'zh-TW': `${baseUrl}/news?hl=zh-TW`,
          ko: `${baseUrl}/news?hl=ko`,
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
  { revalidate: 600, tags: ['news'] },
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
    <div className="theme-body min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Breadcrumb
          items={[{ label: tNav('home'), href: localizedHref('/', locale) }, { label: t('title') }]}
          className="mb-4"
        />

        {/* ヘッダー */}
        <div className="mb-6 flex items-center gap-3">
          <Newspaper className="h-7 w-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
            <p className="text-sm text-gray-400">{t('metaDescription')}</p>
          </div>
        </div>

        {/* カテゴリフィルタ */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const isActive = category === cat.key;
            const href = cat.key ? localizedHref(`/news?category=${cat.key}`, locale) : localizedHref('/news', locale);

            return (
              <a
                key={cat.key || 'all'}
                href={href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {cat.label}
              </a>
            );
          })}
        </div>

        {/* 記事一覧 */}
        {articles.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400">{t('noArticles')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => {
              const style = CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES['site_update']!;
              const publishedDate = new Date(article.published_at).toLocaleDateString(getDateLocale(locale), {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });

              return (
                <a
                  key={article.id}
                  href={localizedHref(`/news/${article.slug}`, locale)}
                  className={`block rounded-xl p-4 transition-colors ${
                    article.featured
                      ? 'border border-yellow-600/30 bg-gradient-to-r from-gray-800 to-gray-800/60 hover:border-yellow-500/50'
                      : 'hover:bg-gray-750 bg-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-bold ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="text-xs text-gray-400">{publishedDate}</span>
                        {article.featured && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />}
                      </div>
                      <h2 className="mb-1 text-lg font-semibold text-white">{sanitizeNewsTitle(article.title)}</h2>
                      {article.excerpt && <p className="line-clamp-2 text-sm text-gray-400">{article.excerpt}</p>}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {page > 1 && (
              <a
                href={localizedHref(`/news?${category ? `category=${category}&` : ''}page=${page - 1}`, locale)}
                className="flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-2 text-gray-300 transition-colors hover:bg-gray-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </a>
            )}
            <span className="px-4 py-2 text-sm text-gray-400">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={localizedHref(`/news?${category ? `category=${category}&` : ''}page=${page + 1}`, locale)}
                className="flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-2 text-gray-300 transition-colors hover:bg-gray-600"
              >
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
