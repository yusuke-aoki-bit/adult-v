import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNewsBySlug } from '@/lib/db/news-queries';
import { localizedHref } from '@adult-v/shared/i18n';
import { ArrowLeft, Clock, Eye } from 'lucide-react';

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new_releases: { bg: 'bg-blue-600', text: 'text-blue-100', label: '新着' },
  sales: { bg: 'bg-red-600', text: 'text-red-100', label: 'セール' },
  ai_analysis: { bg: 'bg-purple-600', text: 'text-purple-100', label: 'AI分析' },
  industry: { bg: 'bg-green-600', text: 'text-green-100', label: '業界ニュース' },
  site_update: { bg: 'bg-gray-600', text: 'text-gray-100', label: 'お知らせ' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getNewsBySlug(slug);

  if (!article) {
    return { title: 'Not Found' };
  }

  return {
    title: `${article.title} - eroxv`,
    description: article.excerpt || article.title,
    alternates: {
      canonical: `/${locale}/news/${slug}`,
    },
  };
}

export const revalidate = 3600;

/**
 * Markdown風のテキストをHTMLに簡易変換
 */
function renderMarkdownContent(content: string): string {
  return content
    // ヘッダー
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3">$1</h2>')
    // 太字
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    // リスト
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-300">$1</li>')
    // 段落
    .replace(/\n\n/g, '</p><p class="text-gray-300 leading-relaxed mb-4">')
    // 改行
    .replace(/\n/g, '<br />');
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const article = await getNewsBySlug(slug);

  if (!article) {
    notFound();
  }

  const style = CATEGORY_STYLES[article.category] || CATEGORY_STYLES['site_update'];
  const publishedDate = new Date(article.published_at).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const htmlContent = renderMarkdownContent(article.content);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 戻るリンク */}
        <a
          href={localizedHref('/news', locale)}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          ニュース一覧に戻る
        </a>

        {/* 記事ヘッダー */}
        <article>
          <div className="flex items-center gap-3 mb-4">
            <span className={`text-xs font-bold px-2 py-1 rounded ${style.bg} ${style.text}`}>
              {style.label}
            </span>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              {publishedDate}
            </div>
            {article.view_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Eye className="w-3.5 h-3.5" />
                {article.view_count}
              </div>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="text-gray-400 text-lg mb-6 border-l-4 border-blue-500 pl-4">
              {article.excerpt}
            </p>
          )}

          {/* AI生成バッジ */}
          {article.source === 'gemini' && (
            <div className="inline-flex items-center gap-1 text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded mb-6">
              AI生成記事 (Gemini)
            </div>
          )}

          {/* 本文 */}
          <div
            className="prose prose-invert max-w-none text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: `<p class="text-gray-300 leading-relaxed mb-4">${htmlContent}</p>`,
            }}
          />

          {/* ソース */}
          {article.source_url && (
            <div className="mt-8 pt-4 border-t border-gray-700">
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                ソースを見る →
              </a>
            </div>
          )}
        </article>

        {/* フッターナビ */}
        <div className="mt-12 pt-6 border-t border-gray-700">
          <a
            href={localizedHref('/news', locale)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            ニュース一覧に戻る
          </a>
        </div>
      </div>
    </div>
  );
}
