import { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { localizedHref } from '@adult-v/shared/i18n';
import { Search, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { SemanticSearchClient } from './SemanticSearchClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isJa = locale === 'ja';

  return {
    title: isJa ? '自然言語検索（AI検索）' : 'Natural Language Search (AI Search)',
    description: isJa
      ? 'AIを活用した自然言語検索。「○○な雰囲気の作品」「△△っぽい女優」など、自然な言葉で作品を探せます。'
      : 'AI-powered natural language search. Find products using natural language like "works with a certain vibe" or "actresses similar to..."',
  };
}

// 翻訳
const translations = {
  ja: {
    title: '自然言語検索',
    subtitle: 'AIがあなたの言葉を理解して作品を探します',
    placeholder: '例: 清楚な雰囲気の熟女作品',
    searchButton: '検索',
    examples: '検索例',
    exampleQueries: [
      '清楚な雰囲気の熟女作品',
      '巨乳でスレンダーな女優',
      '温泉旅館でのシチュエーション',
      'JKコスプレの人気作品',
      '痴漢ものでリアルな演技',
      'お姉さん系の癒し系作品',
    ],
    howItWorks: '仕組み',
    howItWorksDesc: 'この検索はOpenAI の埋め込みベクトル技術を使用しています。あなたの検索クエリと作品情報を数値ベクトルに変換し、意味的な類似度を計算することで、キーワードが一致しなくても関連性の高い作品を見つけることができます。',
    hybridMode: 'ハイブリッドモード',
    hybridModeDesc: 'ハイブリッドモードを有効にすると、AIのセマンティック検索とキーワード検索を組み合わせて、より精度の高い結果を返します。',
    notConfigured: 'セマンティック検索は現在設定中です',
    notConfiguredDesc: 'OpenAI APIキーが設定されていないため、この機能は一時的に利用できません。',
    embeddingStats: 'Embedding統計',
    productsWithEmbedding: 'Embedding生成済み商品',
    performersWithEmbedding: 'Embedding生成済み女優',
    totalProducts: '全商品',
    totalPerformers: '全女優',
    coverage: 'カバレッジ',
  },
  en: {
    title: 'Natural Language Search',
    subtitle: 'AI understands your words and finds products for you',
    placeholder: 'e.g., mature women with elegant atmosphere',
    searchButton: 'Search',
    examples: 'Search Examples',
    exampleQueries: [
      'mature women with elegant atmosphere',
      'busty and slender actresses',
      'hot spring inn scenarios',
      'popular schoolgirl cosplay works',
      'realistic acting in groping scenarios',
      'healing content with older sister type',
    ],
    howItWorks: 'How It Works',
    howItWorksDesc: "This search uses OpenAI's embedding vector technology. By converting your search query and product information into numerical vectors, we can find relevant products even when keywords don't match exactly.",
    hybridMode: 'Hybrid Mode',
    hybridModeDesc: 'Enable hybrid mode to combine AI semantic search with keyword search for more accurate results.',
    notConfigured: 'Semantic search is being configured',
    notConfiguredDesc: 'This feature is temporarily unavailable because the OpenAI API key is not configured.',
    embeddingStats: 'Embedding Stats',
    productsWithEmbedding: 'Products with Embedding',
    performersWithEmbedding: 'Performers with Embedding',
    totalProducts: 'Total Products',
    totalPerformers: 'Total Performers',
    coverage: 'Coverage',
  },
};

export default async function SemanticSearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q } = await searchParams;
  const t = translations[locale as keyof typeof translations] || translations.ja;

  // Embedding統計を取得
  const db = getDb();

  let stats = {
    productsWithEmbedding: 0,
    totalProducts: 0,
    performersWithEmbedding: 0,
    totalPerformers: 0,
  };

  try {
    const [productStats, performerStats] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding,
          COUNT(*) as total
        FROM products
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding,
          COUNT(*) as total
        FROM performers
      `),
    ]);

    stats = {
      productsWithEmbedding: Number(productStats.rows[0]?.with_embedding || 0),
      totalProducts: Number(productStats.rows[0]?.total || 0),
      performersWithEmbedding: Number(performerStats.rows[0]?.with_embedding || 0),
      totalPerformers: Number(performerStats.rows[0]?.total || 0),
    };
  } catch {
    // Embedding統計の取得に失敗した場合は0のまま
  }

  const productCoverage = stats.totalProducts > 0
    ? ((stats.productsWithEmbedding / stats.totalProducts) * 100).toFixed(1)
    : '0';

  const isConfigured = !!process.env.OPENAI_API_KEY;

  return (
    <main className="theme-body min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* PR表記（景品表示法・ステマ規制対応） */}
        <p className="text-xs text-gray-400 mb-4 text-center">
          <span className="font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded mr-1.5">PR</span>
          {locale === 'ja' ? '当ページには広告・アフィリエイトリンクが含まれています' : 'This page contains advertisements and affiliate links'}
        </p>

        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 mb-4">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-purple-300 font-medium">AI-Powered</span>
          </div>
          <h1 className="text-3xl font-bold theme-text mb-2">{t.title}</h1>
          <p className="theme-text-muted">{t.subtitle}</p>
        </div>

        {/* 未設定の場合の警告 */}
        {!isConfigured && (
          <div className="mb-8 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-300">{t.notConfigured}</h3>
                <p className="text-sm text-yellow-200/80 mt-1">{t.notConfiguredDesc}</p>
              </div>
            </div>
          </div>
        )}

        {/* 検索フォーム（クライアントコンポーネント） */}
        <SemanticSearchClient
          locale={locale}
          initialQuery={q}
          translations={{
            placeholder: t.placeholder,
            searchButton: t.searchButton,
            hybridMode: t.hybridMode,
            hybridModeDesc: t.hybridModeDesc,
          }}
          isConfigured={isConfigured}
        />

        {/* 検索例 */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold theme-text mb-4">{t.examples}</h2>
          <div className="flex flex-wrap gap-2">
            {t.exampleQueries.map((example, idx) => (
              <Link
                key={idx}
                href={localizedHref(`/search/semantic?q=${encodeURIComponent(example)}`, locale)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-700/50 hover:bg-gray-700 text-sm theme-text-muted hover:text-white transition-colors"
              >
                {example}
                <ArrowRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </div>

        {/* 仕組みの説明 */}
        <div className="mt-8 p-6 rounded-lg theme-card">
          <h2 className="text-lg font-semibold theme-text mb-3 flex items-center gap-2">
            <Search className="w-5 h-5" />
            {t.howItWorks}
          </h2>
          <p className="theme-text-muted text-sm leading-relaxed">
            {t.howItWorksDesc}
          </p>
        </div>

        {/* Embedding統計 */}
        <div className="mt-8 p-6 rounded-lg theme-card">
          <h2 className="text-lg font-semibold theme-text mb-4">{t.embeddingStats}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {stats.productsWithEmbedding.toLocaleString()}
              </div>
              <div className="text-xs theme-text-muted">{t.productsWithEmbedding}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold theme-text">
                {stats.totalProducts.toLocaleString()}
              </div>
              <div className="text-xs theme-text-muted">{t.totalProducts}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">
                {stats.performersWithEmbedding.toLocaleString()}
              </div>
              <div className="text-xs theme-text-muted">{t.performersWithEmbedding}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold theme-text">
                {stats.totalPerformers.toLocaleString()}
              </div>
              <div className="text-xs theme-text-muted">{t.totalPerformers}</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="theme-text-muted">{t.coverage}</span>
              <span className="text-purple-400 font-medium">{productCoverage}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${productCoverage}%` }}
              />
            </div>
          </div>
        </div>

        {/* 従来の検索へのリンク */}
        <div className="mt-8 text-center">
          <Link
            href={localizedHref('/products', locale)}
            className="inline-flex items-center gap-2 text-sm theme-text-muted hover:text-white transition-colors"
          >
            <Search className="w-4 h-4" />
            {locale === 'ja' ? '従来のキーワード検索はこちら' : 'Use traditional keyword search'}
          </Link>
        </div>
      </div>
    </main>
  );
}
