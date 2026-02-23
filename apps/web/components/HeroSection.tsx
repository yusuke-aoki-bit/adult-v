'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Flame, TrendingUp, Play, Clock } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';
import { normalizeImageUrl } from '@adult-v/shared/lib/image-utils';

interface SaleProduct {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string; profileImageUrl?: string | null }>;
}

interface TrendingActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  releaseCount?: number;
}

interface HeroSectionProps {
  locale: string;
  saleProducts: SaleProduct[];
  trendingActresses?: TrendingActress[];
  totalActressCount?: number;
  totalProductCount?: number;
}

// Hero section translations
const heroTexts = {
  ja: {
    database: 'アダルト動画の',
    databaseHighlight: '総合データベース',
    statsDesc: (actresses: string, products: string) => `${actresses}名以上の女優、${products}本以上の作品を収録`,
    searchProducts: '作品を探す',
    searchActresses: '女優を探す',
    sale: 'SALE',
    maxOff: (percent: number) => `最大 ${percent}% OFF`,
    timeRemainingHours: (h: number, m: number) => `残り${h}時間${m}分`,
    timeRemainingMinutes: (m: number) => `残り${m}分`,
    cast: '出演:',
    others: '他',
    savings: 'お得',
    viewDetails: '詳細を見る',
    allSaleProducts: '全セール商品 →',
    prevProduct: '前の商品',
    nextProduct: '次の商品',
    slide: (n: number) => `スライド ${n}`,
    trendingActresses: '今週のトレンド女優',
    seeMore: 'もっと見る →',
    releases: '本',
  },
  en: {
    database: 'Adult Video ',
    databaseHighlight: 'Database',
    statsDesc: (actresses: string, products: string) => `${actresses}+ actresses, ${products}+ products`,
    searchProducts: 'Browse Products',
    searchActresses: 'Browse Actresses',
    sale: 'SALE',
    maxOff: (percent: number) => `Up to ${percent}% OFF`,
    timeRemainingHours: (h: number, m: number) => `${h}h ${m}m left`,
    timeRemainingMinutes: (m: number) => `${m}m left`,
    cast: 'Cast:',
    others: 'more',
    savings: 'off',
    viewDetails: 'View Details',
    allSaleProducts: 'All Sale Products →',
    prevProduct: 'Previous',
    nextProduct: 'Next',
    slide: (n: number) => `Slide ${n}`,
    trendingActresses: 'Trending Actresses This Week',
    seeMore: 'See more →',
    releases: 'titles',
  },
} as const;
function getHeroText(locale: string) {
  return heroTexts[locale as keyof typeof heroTexts] || heroTexts.ja;
}

// カウントダウンタイマーコンポーネント
function CountdownTimer({ endAt, locale }: { endAt: string | Date; locale: string }) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endAt).getTime();
      // 無効な日付の場合はnullを設定して終了
      if (isNaN(end)) {
        setTimeLeft(null);
        return;
      }
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [endAt]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-1 text-sm">
      <Clock className="h-4 w-4" />
      <span className="font-mono">
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
      <span className="ml-1 text-xs opacity-80">
        {timeLeft.hours > 0
          ? getHeroText(locale).timeRemainingHours(timeLeft.hours, timeLeft.minutes)
          : getHeroText(locale).timeRemainingMinutes(timeLeft.minutes)}
      </span>
    </div>
  );
}

export default function HeroSection({
  locale,
  saleProducts,
  trendingActresses = [],
  totalActressCount = 38000,
  totalProductCount = 120000,
}: HeroSectionProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // 表示する商品（最大5件）
  const heroProducts = saleProducts.slice(0, 5);

  // 自動スライド
  useEffect(() => {
    if (!isAutoPlaying || heroProducts.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroProducts.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isAutoPlaying, heroProducts.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  };

  const goToPrev = () => {
    setCurrentSlide((prev) => (prev - 1 + heroProducts.length) % heroProducts.length);
    setIsAutoPlaying(false);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % heroProducts.length);
    setIsAutoPlaying(false);
  };

  const currentProduct = heroProducts[currentSlide];
  const ht = getHeroText(locale);

  // セールがない場合は統計情報のみ表示
  if (heroProducts.length === 0) {
    return (
      <section className="relative bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="mb-4 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
              {ht.database}
              <span className="text-pink-400">{ht.databaseHighlight}</span>
            </h1>
            <p className="mb-8 text-lg text-gray-300">
              {ht.statsDesc(totalActressCount.toLocaleString(), totalProductCount.toLocaleString())}
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href={localizedHref('/products', locale)}
                className="transform rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 font-bold text-white transition-all hover:scale-105 hover:from-pink-400 hover:to-rose-400"
              >
                {ht.searchProducts}
              </Link>
              <Link
                href={localizedHref('/', locale)}
                className="rounded-lg bg-gray-700 px-6 py-3 font-bold text-white transition-all hover:bg-gray-600"
              >
                {ht.searchActresses}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      {/* 背景グラデーション */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-red-900/30 to-gray-900" />

      {/* メインカルーセル */}
      <div className="relative container mx-auto px-4 py-6 sm:py-10">
        <h1 className="mb-4 text-lg font-bold text-white/90 sm:text-xl">
          {ht.database}
          <span className="text-pink-400">{ht.databaseHighlight}</span>
        </h1>
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
          {/* 左側: 商品情報 */}
          <div className="order-2 space-y-4 lg:order-1">
            {/* セールバッジ */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-3 py-1.5 text-sm font-bold text-white">
                <Flame className="h-4 w-4" />
                {ht.sale}
              </span>
              {currentProduct?.discountPercent && (
                <span className="rounded-full bg-yellow-500 px-3 py-1.5 text-sm font-bold text-black">
                  {ht.maxOff(currentProduct.discountPercent)}
                </span>
              )}
              {currentProduct?.endAt && (
                <div className="rounded-full bg-black/50 px-3 py-1.5 text-white">
                  <CountdownTimer endAt={currentProduct.endAt} locale={locale} />
                </div>
              )}
            </div>

            {/* タイトル */}
            <h2 className="line-clamp-2 text-xl leading-tight font-bold wrap-break-word text-white sm:text-2xl md:text-3xl">
              {currentProduct?.title}
            </h2>

            {/* 出演者 */}
            {currentProduct?.performers && currentProduct.performers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-400">{ht.cast}</span>
                {currentProduct.performers.slice(0, 3).map((performer, i) => (
                  <Link
                    key={performer.id}
                    href={localizedHref(`/actress/${performer.id}`, locale)}
                    className="font-medium text-pink-400 transition-colors hover:text-pink-300"
                  >
                    {performer.name}
                    {i < Math.min(currentProduct.performers.length, 3) - 1 && ', '}
                  </Link>
                ))}
                {currentProduct.performers.length > 3 && <span className="text-sm text-gray-400">{ht.others}</span>}
              </div>
            )}

            {/* 価格 */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-red-400 sm:text-4xl">
                ¥{currentProduct?.salePrice?.toLocaleString()}
              </span>
              <span className="text-lg text-gray-400 line-through">
                ¥{currentProduct?.regularPrice?.toLocaleString()}
              </span>
            </div>
            {currentProduct?.regularPrice &&
              currentProduct?.salePrice &&
              currentProduct.regularPrice > currentProduct.salePrice && (
                <p className="flex items-center gap-1 text-sm text-green-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  ¥{(currentProduct.regularPrice - currentProduct.salePrice).toLocaleString()} {ht.savings}
                </p>
              )}

            {/* CTA */}
            <div className="flex flex-wrap gap-3">
              <Link
                href={localizedHref(`/products/${currentProduct?.productId}`, locale)}
                className="flex-1 transform rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 text-center font-bold text-white shadow-lg shadow-pink-500/30 transition-all hover:scale-105 hover:from-pink-400 hover:to-rose-400 sm:flex-none"
              >
                {ht.viewDetails}
              </Link>
              <Link
                href={localizedHref('/sales', locale)}
                className="flex-1 rounded-lg bg-gray-700/80 px-6 py-3 text-center font-bold text-white transition-all hover:bg-gray-600 sm:flex-none"
              >
                {ht.allSaleProducts}
              </Link>
            </div>
          </div>

          {/* 右側: 画像 */}
          <div className="relative order-1 lg:order-2">
            <div
              className="relative aspect-video overflow-hidden rounded-2xl shadow-2xl sm:aspect-[4/3]"
              onMouseEnter={() => setIsAutoPlaying(false)}
              onMouseLeave={() => setIsAutoPlaying(true)}
            >
              {currentProduct?.thumbnailUrl ? (
                <Image
                  src={normalizeImageUrl(currentProduct.thumbnailUrl)}
                  alt={currentProduct.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  quality={78}
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <Play className="h-16 w-16 text-gray-600" />
                </div>
              )}

              {/* オーバーレイ */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* ナビゲーションボタン */}
              {heroProducts.length > 1 && (
                <>
                  <button
                    onClick={goToPrev}
                    className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition-colors hover:bg-black/70 sm:p-2"
                    aria-label={ht.prevProduct}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition-colors hover:bg-black/70 sm:p-2"
                    aria-label={ht.nextProduct}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>

            {/* ドットインジケーター + スライドカウンター */}
            {heroProducts.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <div className="flex gap-2">
                  {heroProducts.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`h-3 rounded-full p-1 transition-all ${
                        index === currentSlide ? 'w-8 bg-pink-500' : 'w-3 bg-gray-600 hover:bg-gray-500'
                      }`}
                      aria-label={ht.slide(index + 1)}
                    />
                  ))}
                </div>
                <span className="font-mono text-xs text-gray-400">
                  {currentSlide + 1}/{heroProducts.length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* トレンド女優ストリップ */}
        {trendingActresses.length > 0 && (
          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-bold text-white">{ht.trendingActresses}</h3>
              <Link href={localizedHref('/', locale)} className="ml-auto text-sm text-pink-400 hover:text-pink-300">
                {ht.seeMore}
              </Link>
            </div>
            <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-2">
              {trendingActresses.map((actress) => (
                <Link
                  key={actress.id}
                  href={localizedHref(`/actress/${actress.id}`, locale)}
                  className="group flex-shrink-0"
                >
                  <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-transparent transition-all group-hover:ring-pink-500 sm:h-24 sm:w-24">
                    {actress.thumbnailUrl ? (
                      <Image
                        src={normalizeImageUrl(actress.thumbnailUrl)}
                        alt={actress.name}
                        fill
                        className="object-cover"
                        sizes="96px"
                        quality={72}
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-700 text-2xl text-gray-500">
                        {actress.name[0]}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 max-w-20 truncate text-center text-sm text-white transition-colors group-hover:text-pink-400 sm:max-w-24">
                    {actress.name}
                  </p>
                  {actress.releaseCount && (
                    <p className="text-center text-xs text-gray-400">
                      {actress.releaseCount}
                      {ht.releases}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
