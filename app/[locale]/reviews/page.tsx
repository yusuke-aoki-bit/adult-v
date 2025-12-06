import { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { performers } from '@/lib/db/schema';
import { sql, desc, isNotNull } from 'drizzle-orm';
import ActressHeroImage from '@/components/ActressHeroImage';
import Pagination from '@/components/Pagination';
import { generateBaseMetadata } from '@/lib/seo';
import Breadcrumb from '@/components/Breadcrumb';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
}

const PER_PAGE = 24;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;

  return generateBaseMetadata(
    'AI演者レビュー | 女優プロフィール・特徴紹介',
    'AIが分析・作成した女優プロフィールとレビュー。演技スタイル、魅力ポイント、おすすめ作品をチェック。',
    undefined,
    `/${locale}/reviews`,
    undefined,
    locale
  );
}

export default async function ReviewsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const tNav = await getTranslations('nav');

  const page = parseInt(resolvedSearchParams.page || '1', 10);
  const searchQuery = resolvedSearchParams.q || '';

  const db = getDb();

  // AIレビューを持つ演者を取得
  // 検索クエリがある場合は、演者名またはレビュー本文で検索
  const searchPattern = searchQuery ? `%${searchQuery}%` : null;

  const performerList = await db
    .select({
      id: performers.id,
      name: performers.name,
      aiReview: performers.aiReview,
      aiReviewUpdatedAt: performers.aiReviewUpdatedAt,
      profileImageUrl: performers.profileImageUrl,
    })
    .from(performers)
    .where(
      searchPattern
        ? sql`${performers.aiReview} IS NOT NULL AND (${performers.name} ILIKE ${searchPattern} OR ${performers.aiReview} ILIKE ${searchPattern})`
        : isNotNull(performers.aiReview)
    )
    .orderBy(desc(performers.aiReviewUpdatedAt))
    .limit(1000);

  const total = performerList.length;
  const paginatedList = performerList.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const basePath = `/${locale}/reviews`;

  return (
    <div className="bg-gray-900 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: tNav('home'), href: `/${locale}` },
            { label: 'レビュー' },
          ]}
          className="mb-6"
        />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <svg className="w-8 h-8 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            AI演者レビュー
          </h1>
          <p className="text-gray-400 mt-2">
            AIが分析・作成した女優プロフィールとレビュー（{total}名）
          </p>
        </div>

        {/* 検索フォーム */}
        <div className="mb-8">
          <form action={basePath} method="GET" className="flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="演者名やレビュー内容で検索..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              検索
            </button>
            {searchQuery && (
              <Link
                href={basePath}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                クリア
              </Link>
            )}
          </form>
        </div>

        {/* 演者リスト */}
        {total > 0 ? (
          <>
            {total > PER_PAGE && (
              <Pagination total={total} page={page} perPage={PER_PAGE} basePath={basePath} position="top" />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {paginatedList.map((performer) => {
                let review: { overview?: string; keywords?: string[] } = {};
                try {
                  review = performer.aiReview ? JSON.parse(performer.aiReview) : {};
                } catch {
                  // パースエラーは無視
                }

                return (
                  <Link
                    key={performer.id}
                    href={`/${locale}/actress/${performer.id}`}
                    className="bg-gray-800 rounded-xl overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all group"
                  >
                    <div className="relative h-48 bg-gray-700">
                      <ActressHeroImage
                        src={performer.profileImageUrl || undefined}
                        alt={performer.name}
                        size={192}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute top-2 right-2">
                        <span className="text-xs bg-purple-600/80 text-white px-2 py-1 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                          </svg>
                          AI
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-white text-lg mb-2">{performer.name}</h3>
                      {review.overview && (
                        <p className="text-gray-400 text-sm line-clamp-3">
                          {review.overview}
                        </p>
                      )}
                      {review.keywords && review.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {review.keywords.slice(0, 3).map((keyword, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
                              #{keyword}
                            </span>
                          ))}
                        </div>
                      )}
                      {performer.aiReviewUpdatedAt && (
                        <p className="text-xs text-gray-500 mt-3">
                          {new Date(performer.aiReviewUpdatedAt).toLocaleDateString('ja-JP')}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>

            {total > PER_PAGE && (
              <Pagination total={total} page={page} perPage={PER_PAGE} basePath={basePath} position="bottom" />
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">
              <svg className="w-16 h-16 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {searchQuery ? '該当する演者が見つかりません' : 'レビューがまだありません'}
            </h2>
            <p className="text-gray-400">
              {searchQuery
                ? '別のキーワードで検索してみてください'
                : 'AIレビューは順次生成されます。しばらくお待ちください。'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
