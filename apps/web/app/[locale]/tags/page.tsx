import { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { JsonLD } from '@/components/JsonLD';
import Breadcrumb from '@/components/Breadcrumb';
import { SocialShareButtons } from '@adult-v/shared/components';
import { getPopularTags } from '@/lib/db/queries';
import { generateBaseMetadata, generateBreadcrumbSchema, generateCollectionPageSchema, generateFAQSchema, generateItemListSchema } from '@/lib/seo';
import { localizedHref } from '@adult-v/shared/i18n';
import { unstable_cache } from 'next/cache';

// getTranslationsがheaders()を呼ぶためISR(revalidate)は無効 → force-dynamic
export const dynamic = 'force-dynamic';

// DB query cache (3600秒)
const getCachedTagsByCategory = unstable_cache(
  async (category: string, limit: number) => {
    return getPopularTags({ category, limit });
  },
  ['tags-by-category'],
  { revalidate: 3600, tags: ['tags'] }
);

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'https://example.com';

  const title = '人気ジャンルランキング | Adult Viewer Lab';
  const description = '今人気のAVジャンル・カテゴリをランキング形式で紹介。熟女、巨乳、人妻、素人など各ジャンルの人気作品数や関連作品をチェック。';

  const metadata = generateBaseMetadata(
    title,
    description,
    undefined,
    localizedHref('/tags', locale),
    undefined,
    locale,
  );

  return {
    ...metadata,
    alternates: {
      canonical: `${baseUrl}/tags`,
      languages: {
        'ja': `${baseUrl}/tags`,
        'en': `${baseUrl}/tags?hl=en`,
        'zh': `${baseUrl}/tags?hl=zh`,
        'zh-TW': `${baseUrl}/tags?hl=zh-TW`,
        'ko': `${baseUrl}/tags?hl=ko`,
        'x-default': `${baseUrl}/tags`,
      },
    },
  };
}

export default async function TagsRankingPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations('categories');
  const tCommon = await getTranslations('common');
  const tNav = await getTranslations({ locale, namespace: 'nav' });

  // カテゴリ別に人気タグを取得
  const [genreTags, situationTags, playTags, bodyTags, costumeTags] = await Promise.all([
    getCachedTagsByCategory('genre', 30),
    getCachedTagsByCategory('situation', 20),
    getCachedTagsByCategory('play', 20),
    getCachedTagsByCategory('body', 20),
    getCachedTagsByCategory('costume', 20),
  ]);

  // パンくずリスト
  const breadcrumbItems = [
    { name: tCommon('products'), url: localizedHref('/', locale) },
    { name: '人気ジャンルランキング', url: localizedHref('/tags', locale) },
  ];

  // FAQ
  const faqs = [
    {
      question: '人気のAVジャンルは何ですか？',
      answer: '人気のAVジャンルは熟女、巨乳、人妻、素人、OL、女子大生などが上位にランクインしています。当サイトでは作品数に基づいてランキングを作成しています。',
    },
    {
      question: 'ジャンル別に作品を探すには？',
      answer: '各ジャンル名をクリックすると、そのジャンルの作品一覧ページに移動できます。新作順、人気順、セール順で並び替えも可能です。',
    },
  ];

  // ItemListSchema用
  const topTags = [...genreTags.slice(0, 10)];
  const itemListData = topTags.map((tag) => ({
    name: tag.name,
    url: localizedHref(`/tags/${tag.id}`, locale),
  }));

  const categoryData = [
    { title: '人気ジャンル TOP30', tags: genreTags, icon: '🎬' },
    { title: 'シチュエーション', tags: situationTags, icon: '🎭' },
    { title: 'プレイ', tags: playTags, icon: '💋' },
    { title: '体型・ルックス', tags: bodyTags, icon: '👙' },
    { title: '衣装・コスプレ', tags: costumeTags, icon: '👗' },
  ];

  return (
    <div className="theme-body min-h-screen">
      <JsonLD
        data={[
          generateBreadcrumbSchema(breadcrumbItems),
          generateCollectionPageSchema(
            '人気ジャンルランキング',
            '今人気のAVジャンル・カテゴリをランキング形式で紹介',
            localizedHref('/tags', locale),
            locale,
          ),
          generateItemListSchema(itemListData, '人気ジャンルランキング'),
          generateFAQSchema(faqs),
        ]}
      />

      <section className="py-3 sm:py-4 md:py-6 scroll-mt-20">
        <div className="container mx-auto px-3 sm:px-4">
          <Breadcrumb
            items={[
              { label: tNav('home'), href: localizedHref('/', locale) },
              { label: '人気ジャンルランキング' },
            ]}
            className="mb-2 sm:mb-3"
          />

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">
                🏆 人気ジャンルランキング
              </h1>
              <p className="text-gray-400">
                作品数に基づいた人気ジャンル・カテゴリのランキング
              </p>
            </div>
            <SocialShareButtons
              title="人気AVジャンルランキング"
              compact
              hashtags={['AV', 'ジャンル', 'ランキング']}
            />
          </div>

          {/* カテゴリ別ランキング */}
          <div className="space-y-8">
            {categoryData.map(({ title, tags, icon }) => (
              tags.length > 0 && (
                <section key={title} className="bg-gray-800/50 rounded-xl p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>{icon}</span>
                    {title}
                  </h2>
                  <div className="space-y-2">
                    {tags.map((tag, index) => (
                      <Link
                        key={tag.id}
                        href={localizedHref(`/tags/${tag.id}`, locale)}
                        className="flex items-center gap-3 p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors group"
                      >
                        <span className={`
                          w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold
                          ${index === 0 ? 'bg-yellow-500 text-black' : ''}
                          ${index === 1 ? 'bg-gray-300 text-black' : ''}
                          ${index === 2 ? 'bg-amber-600 text-white' : ''}
                          ${index > 2 ? 'bg-gray-600 text-gray-300' : ''}
                        `}>
                          {index + 1}
                        </span>
                        <span className="flex-1 text-white group-hover:text-rose-400 font-medium transition-colors">
                          {tag.name}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {tag.count.toLocaleString()}作品
                        </span>
                        <svg className="w-4 h-4 text-gray-500 group-hover:text-rose-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            ))}
          </div>

          {/* カテゴリ一覧へのリンク */}
          <div className="mt-8 pt-6 border-t border-gray-700 flex flex-wrap gap-4">
            <Link
              href={localizedHref('/categories', locale)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              全カテゴリ一覧
            </Link>
            <Link
              href={localizedHref('/products', locale)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              作品を検索
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
