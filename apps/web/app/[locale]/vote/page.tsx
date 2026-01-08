'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Vote, Trophy, TrendingUp, Clock, Star, ThumbsUp, Loader2, Crown, Medal, Flame } from 'lucide-react';
import { useFirebaseAuth } from '@adult-v/shared/contexts';

interface VotableProduct {
  id: number;
  title: string;
  imageUrl: string | null;
  performers: string[];
  releaseDate: string | null;
  voteCount: number;
  rank: number;
  hasVoted: boolean;
}

interface VoteCategory {
  id: string;
  name: string;
  description: string;
  icon: 'star' | 'fire' | 'trophy';
}

const translations = {
  ja: {
    title: '作品ランキング投票',
    subtitle: 'あなたの一票でランキングが決まる',
    categories: {
      best: '今月のベスト作品',
      trending: '今週の話題作',
      classic: '殿堂入り名作',
    },
    categoryDesc: {
      best: '今月リリースされた作品の中から投票',
      trending: '今週話題になっている作品に投票',
      classic: '時を超えて愛される名作に投票',
    },
    votes: '票',
    vote: '投票する',
    voted: '投票済み',
    loginToVote: 'ログインして投票',
    loading: '読み込み中...',
    noProducts: '投票可能な作品がありません',
    ranking: 'ランキング',
    yourVotes: 'あなたの投票',
    totalVotes: '総投票数',
    participants: '参加者数',
    error: 'エラーが発生しました',
    viewProduct: '作品詳細を見る',
  },
  en: {
    title: 'Product Ranking Vote',
    subtitle: 'Your vote determines the rankings',
    categories: {
      best: 'Best of the Month',
      trending: 'Trending This Week',
      classic: 'Hall of Fame',
    },
    categoryDesc: {
      best: 'Vote for products released this month',
      trending: 'Vote for trending products this week',
      classic: 'Vote for timeless classics',
    },
    votes: 'votes',
    vote: 'Vote',
    voted: 'Voted',
    loginToVote: 'Login to vote',
    loading: 'Loading...',
    noProducts: 'No products available for voting',
    ranking: 'Rankings',
    yourVotes: 'Your Votes',
    totalVotes: 'Total Votes',
    participants: 'Participants',
    error: 'An error occurred',
    viewProduct: 'View Product',
  },
};

const categories: VoteCategory[] = [
  { id: 'best', name: 'Best of Month', description: '', icon: 'star' },
  { id: 'trending', name: 'Trending', description: '', icon: 'fire' },
  { id: 'classic', name: 'Hall of Fame', description: '', icon: 'trophy' },
];

function CategoryIcon({ icon }: { icon: 'star' | 'fire' | 'trophy' }) {
  if (icon === 'star') return <Star className="w-5 h-5" />;
  if (icon === 'fire') return <Flame className="w-5 h-5" />;
  return <Trophy className="w-5 h-5" />;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
  if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
  return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold text-sm">#{rank}</span>;
}

function getRankBg(rank: number) {
  if (rank === 1) return 'bg-gradient-to-r from-yellow-900/30 to-amber-900/20 border-yellow-500/30';
  if (rank === 2) return 'bg-gradient-to-r from-gray-800/50 to-gray-700/30 border-gray-400/30';
  if (rank === 3) return 'bg-gradient-to-r from-amber-900/30 to-orange-900/20 border-amber-600/30';
  return 'bg-gray-800/30 border-gray-700/50';
}

export default function VotePage() {
  const params = useParams();
  const locale = (params?.['locale'] as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  const { user, isLoading: isAuthLoading } = useFirebaseAuth();
  const userId = user?.uid ?? null;

  const [activeCategory, setActiveCategory] = useState('best');
  const [products, setProducts] = useState<VotableProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingProductId, setVotingProductId] = useState<number | null>(null);
  const [stats, setStats] = useState({ totalVotes: 0, participants: 0 });

  // カテゴリに応じた翻訳を取得
  const getCategoryName = (categoryId: string) => {
    return t.categories[categoryId as keyof typeof t.categories] || categoryId;
  };

  const getCategoryDesc = (categoryId: string) => {
    return t.categoryDesc[categoryId as keyof typeof t.categoryDesc] || '';
  };

  // 投票データを取得
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/vote/products?category=${activeCategory}&userId=${userId || ''}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setProducts(data.products || []);
        setStats({
          totalVotes: data.totalVotes || 0,
          participants: data.participants || 0,
        });
      } catch {
        // API がない場合はダミーデータを表示
        setProducts([]);
        setStats({ totalVotes: 0, participants: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [activeCategory, userId]);

  // 投票処理
  const handleVote = async (productId: number) => {
    if (!userId) return;
    if (votingProductId) return;

    setVotingProductId(productId);

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          category: activeCategory,
          userId,
        }),
      });

      if (!response.ok) throw new Error('Vote failed');

      // 楽観的更新
      setProducts(prev =>
        prev.map(p =>
          p.id === productId
            ? { ...p, voteCount: p.voteCount + 1, hasVoted: true }
            : p
        ).sort((a, b) => b.voteCount - a.voteCount)
         .map((p, i) => ({ ...p, rank: i + 1 }))
      );
      setStats(prev => ({ ...prev, totalVotes: prev.totalVotes + 1 }));
    } catch {
      setError(t.error);
    } finally {
      setVotingProductId(null);
    }
  };

  return (
    <div className="theme-body min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* PR表記 */}
        <p className="text-xs theme-text-muted mb-6">
          <span className="font-bold text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded mr-1.5">PR</span>
          当ページには広告・アフィリエイトリンクが含まれています
        </p>

        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-full mb-4">
            <Vote className="w-5 h-5" />
            <span className="font-bold">VOTE NOW</span>
          </div>
          <h1 className="text-3xl font-bold theme-text mb-2">{t.title}</h1>
          <p className="theme-text-muted">{t.subtitle}</p>
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="theme-card rounded-lg p-4 text-center">
            <div className="text-2xl font-bold theme-text">{stats.totalVotes}</div>
            <div className="text-sm theme-text-muted">{t.totalVotes}</div>
          </div>
          <div className="theme-card rounded-lg p-4 text-center">
            <div className="text-2xl font-bold theme-text">{stats.participants}</div>
            <div className="text-sm theme-text-muted">{t.participants}</div>
          </div>
        </div>

        {/* カテゴリタブ */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeCategory === category.id
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <CategoryIcon icon={category.icon} />
              <div className="text-left">
                <div>{getCategoryName(category.id)}</div>
                <div className="text-xs opacity-70">{getCategoryDesc(category.id)}</div>
              </div>
            </button>
          ))}
        </div>

        {/* ログインプロンプト */}
        {!isAuthLoading && !userId && (
          <div className="theme-card rounded-lg p-6 text-center mb-8">
            <Vote className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p className="theme-text-muted mb-4">{t.loginToVote}</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="text-center py-4 text-red-400 mb-4">
            {error}
          </div>
        )}

        {/* ローディング */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">{t.loading}</span>
          </div>
        )}

        {/* 作品リスト */}
        {!isLoading && products.length === 0 ? (
          <div className="theme-card rounded-lg p-8 text-center theme-text-muted">
            {t.noProducts}
          </div>
        ) : (
          <div className="space-y-3">
            {products.map(product => (
              <div
                key={product.id}
                className={`theme-card rounded-lg overflow-hidden border ${getRankBg(product.rank)} transition-all`}
              >
                <div className="flex items-center">
                  {/* ランク */}
                  <div className="flex-shrink-0 w-16 flex items-center justify-center">
                    {getRankIcon(product.rank)}
                  </div>

                  {/* サムネイル */}
                  <div className="flex-shrink-0 w-20 h-28 bg-gray-700 overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* コンテンツ */}
                  <div className="flex-1 p-4 min-w-0">
                    <Link
                      href={`/${locale}/products/${product.id}`}
                      className="font-bold theme-text hover:text-rose-400 transition-colors line-clamp-2 mb-1"
                    >
                      {product.title}
                    </Link>
                    {product.performers.length > 0 && (
                      <p className="text-sm theme-text-muted line-clamp-1 mb-2">
                        {product.performers.slice(0, 3).join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex items-center gap-1 text-yellow-400">
                        <ThumbsUp className="w-4 h-4" />
                        {product.voteCount} {t.votes}
                      </span>
                    </div>
                  </div>

                  {/* 投票ボタン */}
                  <div className="flex-shrink-0 pr-4">
                    {userId ? (
                      <button
                        onClick={() => handleVote(product.id)}
                        disabled={product.hasVoted || votingProductId === product.id}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                          product.hasVoted
                            ? 'bg-green-600/30 text-green-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500'
                        }`}
                      >
                        {votingProductId === product.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : product.hasVoted ? (
                          <>
                            <ThumbsUp className="w-4 h-4" />
                            {t.voted}
                          </>
                        ) : (
                          <>
                            <Vote className="w-4 h-4" />
                            {t.vote}
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="text-xs theme-text-muted px-4 py-2">
                        {t.loginToVote}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
