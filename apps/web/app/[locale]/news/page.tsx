import { Metadata } from 'next';
import { getNewsByCategory } from '@/lib/db/news-queries';
import { localizedHref } from '@adult-v/shared/i18n';
import { Newspaper, Star, ChevronLeft, ChevronRight } from 'lucide-react';

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new_releases: { bg: 'bg-blue-600', text: 'text-blue-100', label: '新着' },
  sales: { bg: 'bg-red-600', text: 'text-red-100', label: 'セール' },
  ai_analysis: { bg: 'bg-purple-600', text: 'text-purple-100', label: '分析' },
  industry: { bg: 'bg-green-600', text: 'text-green-100', label: '業界' },
  site_update: { bg: 'bg-gray-600', text: 'text-gray-100', label: 'お知らせ' },
};

const CATEGORIES = [
  { key: null, label: 'すべて' },
  { key: 'new_releases', label: '新着' },
  { key: 'sales', label: 'セール' },
  { key: 'ai_analysis', label: 'AI分析' },
  { key: 'site_update', label: 'お知らせ' },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === 'ja' ? 'ニュース - eroxv' : 'News - eroxv';
  const description = locale === 'ja'
    ? '新着情報、セール速報、トレンド分析などの最新ニュース'
    : 'Latest news, sale alerts, and trend analysis';

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/news`,
    },
  };
}

export const revalidate = 600;

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const category = sp.category || null;
  const page = parseInt(sp.page || '1');
  const limit = 20;

  const { articles, total } = await getNewsByCategory(category, page, limit);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <Newspaper className="w-7 h-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">ニュース</h1>
            <p className="text-sm text-gray-400">最新情報・セール・トレンド</p>
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
            <p className="text-gray-400">ニュースはまだありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => {
              const style = CATEGORY_STYLES[article.category] || CATEGORY_STYLES['site_update'];
              const publishedDate = new Date(article.published_at).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });

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
                前へ
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
                次へ
                <ChevronRight className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
