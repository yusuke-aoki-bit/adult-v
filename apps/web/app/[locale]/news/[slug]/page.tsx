import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getNewsBySlug } from '@/lib/db/news-queries';
import { generateBaseMetadata, generateBreadcrumbSchema } from '@/lib/seo';
import { localizedHref } from '@adult-v/shared/i18n';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { ArrowLeft, Clock, Eye } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  try {
    const { locale, slug } = await params;
    const article = await getNewsBySlug(slug);

    if (!article) {
      return { title: 'Not Found' };
    }

    const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

    const metadata = generateBaseMetadata(
      sanitizeNewsTitle(article.title),
      article.excerpt || sanitizeNewsTitle(article.title),
      undefined,
      localizedHref(`/news/${slug}`, locale),
      undefined,
      locale,
    );

    return {
      ...metadata,
      alternates: {
        canonical: `${baseUrl}/news/${slug}`,
        languages: {
          ja: `${baseUrl}/news/${slug}`,
          en: `${baseUrl}/news/${slug}?hl=en`,
          zh: `${baseUrl}/news/${slug}?hl=zh`,
          'zh-TW': `${baseUrl}/news/${slug}?hl=zh-TW`,
          ko: `${baseUrl}/news/${slug}?hl=ko`,
          'x-default': `${baseUrl}/news/${slug}`,
        },
      },
    };
  } catch {
    return {};
  }
}

// ISR: locale明示でheaders()回避済み → パブリックキャッシュ有効
export const revalidate = 60;

/**
 * Markdown風のテキストをHTMLに簡易変換
 */
function renderMarkdownContent(content: string): string {
  return content
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-300">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-gray-300 leading-relaxed mb-4">')
    .replace(/\n/g, '<br />');
}

/** Strip stale/hallucinated dates from AI-generated titles */
function sanitizeNewsTitle(title: string): string {
  const now = new Date();
  const todayStr = `${now.getMonth() + 1}月${now.getDate()}日`;
  let s = title.replace(/[〇○]月[〇○]日/g, todayStr);
  s = s.replace(/[（(]20\d{2}[/／]\d{1,2}[/／]\d{1,2}[)）]/g, '');
  s = s.replace(/【20\d{2}[/／]\d{1,2}[/／]\d{1,2}】/g, `【${todayStr}】`);
  s = s.replace(/【[〇○]月[〇○]日】/g, `【${todayStr}】`);
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

export default async function NewsDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;

  let article, t, tNav;
  try {
    [article, t, tNav] = await Promise.all([
      getNewsBySlug(slug),
      getTranslations({ locale, namespace: 'news' }),
      getTranslations({ locale, namespace: 'nav' }),
    ]);
  } catch (error) {
    console.error(`[news-detail] Error loading news ${slug}:`, error);
    notFound();
  }

  if (!article) {
    notFound();
  }

  const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    new_releases: { bg: 'bg-blue-600', text: 'text-blue-100', label: t('newReleases') },
    sales: { bg: 'bg-red-600', text: 'text-red-100', label: t('sales') },
    ai_analysis: { bg: 'bg-purple-600', text: 'text-purple-100', label: t('aiAnalysis') },
    industry: { bg: 'bg-green-600', text: 'text-green-100', label: t('industry') },
    site_update: { bg: 'bg-gray-600', text: 'text-gray-100', label: t('siteUpdate') },
  };

  const style = CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES['site_update']!;
  const publishedDate = new Date(article.published_at).toLocaleDateString(getDateLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const htmlContent = renderMarkdownContent(article.content);

  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://www.adult-v.com';

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: sanitizeNewsTitle(article.title),
    description: article.excerpt || sanitizeNewsTitle(article.title),
    datePublished: new Date(article.published_at).toISOString(),
    dateModified: new Date(article.updated_at).toISOString(),
    url: `${baseUrl}/news/${slug}`,
    ...(article.image_url ? { image: article.image_url } : {}),
    author: {
      '@type': 'Organization',
      name: 'Adult Viewer Lab',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Adult Viewer Lab',
      url: baseUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/news/${slug}`,
    },
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: tNav('home'), url: localizedHref('/', locale) },
    { name: t('title'), url: localizedHref('/news', locale) },
    { name: sanitizeNewsTitle(article.title), url: localizedHref(`/news/${slug}`, locale) },
  ]);

  return (
    <div className="theme-body min-h-screen">
      <JsonLD data={[articleSchema, breadcrumbSchema]} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Breadcrumb
          items={[
            { label: tNav('home'), href: localizedHref('/', locale) },
            { label: t('title'), href: localizedHref('/news', locale) },
            { label: sanitizeNewsTitle(article.title) },
          ]}
          className="mb-4"
        />

        {/* 戻るリンク */}
        <a
          href={localizedHref('/news', locale)}
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToList')}
        </a>

        {/* 記事 */}
        <article>
          <div className="mb-4 flex items-center gap-3">
            <span className={`rounded px-2 py-1 text-xs font-bold ${style.bg} ${style.text}`}>{style.label}</span>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {publishedDate}
            </div>
            {article.view_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Eye className="h-3.5 w-3.5" />
                {article.view_count}
              </div>
            )}
          </div>

          <h1 className="mb-4 text-2xl font-bold text-white md:text-3xl">{sanitizeNewsTitle(article.title)}</h1>

          {article.excerpt && (
            <p className="mb-6 border-l-4 border-blue-500 pl-4 text-lg text-gray-400">{article.excerpt}</p>
          )}

          {/* AI生成バッジ */}
          {article.source === 'gemini' && (
            <div className="mb-6 inline-flex items-center gap-1 rounded bg-purple-900/30 px-2 py-1 text-xs text-purple-400">
              AI Generated (Gemini)
            </div>
          )}

          {/* 本文 */}
          <div
            className="prose prose-invert max-w-none leading-relaxed text-gray-300"
            dangerouslySetInnerHTML={{
              __html: `<p class="text-gray-300 leading-relaxed mb-4">${htmlContent}</p>`,
            }}
          />

          {/* ソース */}
          {article.source_url && (
            <div className="mt-8 border-t border-gray-700 pt-4">
              <a
                href={article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 transition-colors hover:text-blue-300"
              >
                Source →
              </a>
            </div>
          )}
        </article>

        {/* フッターナビ */}
        <div className="mt-12 border-t border-gray-700 pt-6">
          <a
            href={localizedHref('/news', locale)}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToList')}
          </a>
        </div>
      </div>
    </div>
  );
}
