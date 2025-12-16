'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useSearchParams, useParams } from 'next/navigation';
import { Product } from '@/types/product';
import { normalizeImageUrl, getFullSizeImageUrl, isDtiUncensoredSite, isSubscriptionSite } from '@/lib/image-utils';
import { generateAltText } from '@/lib/seo-utils';
import { formatPrice } from '@/lib/utils/subscription';
import { providerMeta, type ProviderId } from '@/lib/providers';
import FavoriteButton from './FavoriteButton';
import ViewedButton from './ViewedButton';
import ImageLightbox from './ImageLightbox';
import StarRating from './StarRating';
import { getVariant, trackCtaClick } from '@/lib/ab-testing';

/**
 * MGS商品IDを正規化（ハイフンがない場合は適切な位置に挿入）
 */
function normalizeMgsProductId(productId: string): string {
  if (productId.includes('-')) return productId;
  const prefixMatch = productId.match(/^(\d+)([A-Z]+)(\d+)$/i);
  if (prefixMatch) return `${prefixMatch[1]}${prefixMatch[2]}-${prefixMatch[3]}`;
  const simpleMatch = productId.match(/^([A-Z]+)(\d+)$/i);
  if (simpleMatch) return `${simpleMatch[1]}-${simpleMatch[2]}`;
  return productId;
}

/**
 * MGSウィジェットコードから実際の商品ページURLを抽出
 */
function extractMgsProductUrl(widgetCode: string): string | null {
  const productIdMatch = widgetCode.match(/[?&]p=([^&"']+)/);
  const affCodeMatch = widgetCode.match(/[?&]c=([^&"']+)/);
  if (productIdMatch) {
    const productId = normalizeMgsProductId(productIdMatch[1]);
    const affCode = affCodeMatch ? affCodeMatch[1] : '';
    const affParam = affCode ? `?aff=${affCode}` : '';
    return `https://www.mgstage.com/product/product_detail/${productId}/${affParam}`;
  }
  return null;
}

/**
 * アフィリエイトURLを取得（MGSウィジェットの場合は変換）
 */
function getAffiliateUrl(affiliateUrl: string | undefined | null): string | null {
  if (!affiliateUrl) return null;
  if (affiliateUrl.includes('mgs_Widget_affiliate')) {
    return extractMgsProductUrl(affiliateUrl);
  }
  if (affiliateUrl.startsWith('http://') || affiliateUrl.startsWith('https://')) {
    return affiliateUrl;
  }
  return null;
}

interface ProductCardProps {
  product: Product;
  /** 人気ランキング順位（1-10の場合にバッジ表示） */
  rankPosition?: number;
  /** コンパクト表示（グリッド用の小さいカード） */
  compact?: boolean;
  /** ミニ表示（最近見た作品用のサムネイルのみ表示） */
  mini?: boolean;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x560/1f2937/ffffff?text=NO+IMAGE';

export default function ProductCard({ product, rankPosition, compact = false, mini = false }: ProductCardProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = useTranslations('productCard');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasValidImageUrl = product.imageUrl && product.imageUrl.trim() !== '';
  const [imgSrc, setImgSrc] = useState(hasValidImageUrl ? normalizeImageUrl(product.imageUrl) : PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // サンプル動画があるかどうか
  const hasSampleVideo = product.sampleVideos && product.sampleVideos.length > 0;
  const primaryVideo = hasSampleVideo ? product.sampleVideos![0] : null;

  // 全画像配列（メイン画像 + サンプル画像）- サムネイルURLを高解像度に変換
  const allImages = useMemo(() => {
    const images: string[] = [];
    if (hasValidImageUrl && product.imageUrl) {
      const normalized = normalizeImageUrl(product.imageUrl);
      const fullSize = getFullSizeImageUrl(normalized);
      images.push(fullSize);
    }
    if (product.sampleImages && product.sampleImages.length > 0) {
      product.sampleImages.forEach(img => {
        const normalized = normalizeImageUrl(img);
        const fullSize = getFullSizeImageUrl(normalized);
        if (!images.includes(fullSize)) {
          images.push(fullSize);
        }
      });
    }
    return images;
  }, [product.imageUrl, product.sampleImages, hasValidImageUrl]);


  // 女優ページかどうかを判定
  const isActressPage = pathname.includes('/actress/');

  // ASPフィルタURLを生成
  const getAspFilterUrl = useCallback((provider: string) => {
    // 女優ページの場合は現在のページ+ASPフィルタ
    if (isActressPage) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('includeAsp', provider);
      params.delete('page');
      return `${pathname}?${params.toString()}`;
    }
    // それ以外は作品一覧ページへ
    return `/${locale}/products?includeAsp=${provider}`;
  }, [isActressPage, pathname, searchParams, locale]);

  // タグリンクのURLを生成（既存のフィルターにタグを追加）
  const getTagFilterUrl = useCallback((tag: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const existingInclude = params.get('include');

    if (existingInclude) {
      // 既存のタグがある場合、重複チェックしてから追加
      const existingTags = existingInclude.split(',').map(t => t.trim());
      if (!existingTags.includes(tag)) {
        params.set('include', [...existingTags, tag].join(','));
      }
      // すでに含まれている場合は何も変更しない
    } else {
      params.set('include', tag);
    }

    params.delete('page'); // ページをリセット

    if (isActressPage) {
      return `${pathname}?${params.toString()}`;
    }
    // 作品一覧ページへ遷移（既存のフィルターも引き継ぐ）
    return `/${locale}/products?${params.toString()}`;
  }, [isActressPage, pathname, searchParams, locale]);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  // DTI系（無修正）サイトの画像かどうか
  const isUncensored = isDtiUncensoredSite(imgSrc);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // プレースホルダー画像の場合はモーダルを開かない（無修正はブラー付きで拡大OK）
    if (imgSrc !== PLACEHOLDER_IMAGE && hasValidImageUrl && !hasError) {
      setShowModal(true);
    }
  }, [imgSrc, hasValidImageUrl, hasError]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setModalImageIndex(0);
  }, []);

  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasSampleVideo) {
      setShowVideoModal(true);
    }
  }, [hasSampleVideo]);

  const handleCloseVideoModal = useCallback(() => {
    setShowVideoModal(false);
  }, []);

  // ミニモード: 最近見た作品用の超コンパクトサムネイル（タイトルなし）
  if (mini) {
    return (
      <Link
        href={`/${locale}/products/${product.id}`}
        className="block group"
      >
        <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-800">
          <Image
            src={imgSrc}
            alt={product.title}
            fill
            sizes="80px"
            className={`object-cover transition-transform group-hover:scale-105 ${isUncensored ? 'blur-[3px]' : ''}`}
            loading="lazy"
            onError={handleImageError}
          />
          {/* セールバッジ */}
          {product.salePrice && (
            <div className="absolute top-0.5 left-0.5 bg-red-600 text-white text-[8px] font-bold px-1 py-0.5 rounded z-10">
              SALE
            </div>
          )}
        </div>
      </Link>
    );
  }

  // コンパクトモード: 最小限の情報でサムネイル表示（イベント機能付き）
  if (compact) {
    return (
      <>
        <div className="relative block bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/50 transition-all group">
          <Link href={`/${locale}/products/${product.id}`}>
            <div className="relative aspect-[2/3] bg-gradient-to-br from-gray-700 to-gray-800">
              <Image
                src={imgSrc}
                alt={product.title}
                fill
                className={`object-cover transition-transform duration-300 group-hover:scale-105 ${isUncensored ? 'blur-[3px]' : ''}`}
                sizes="(max-width: 768px) 33vw, 12.5vw"
                loading="lazy"
                onError={handleImageError}
              />
              {/* セールバッジ */}
              {product.salePrice && (
                <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded z-10">
                  SALE
                </div>
              )}
            </div>
            <div className="p-1.5">
              <h3 className="text-xs font-medium text-white line-clamp-2 leading-tight">{product.title}</h3>
            </div>
          </Link>

          {/* 動画再生ボタン */}
          {hasSampleVideo && (
            <button
              type="button"
              onClick={handleVideoClick}
              className="absolute top-1 left-1 z-20 bg-black/70 hover:bg-black/90 text-white p-1 rounded-full transition-all hover:scale-110"
              style={{ marginLeft: product.salePrice ? '40px' : '0' }}
              aria-label={t('playSampleVideo')}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          {/* お気に入り・視聴済みボタン */}
          <div className="absolute top-1 right-1 flex gap-0.5 z-20">
            <FavoriteButton type="product" id={product.id} size="xs" />
            <ViewedButton
              productId={String(product.id)}
              title={product.title}
              imageUrl={product.imageUrl ?? null}
              aspName={product.providerLabel ?? product.provider ?? 'unknown'}
              performerName={product.actressName ?? product.performers?.[0]?.name}
              performerId={product.actressId ?? product.performers?.[0]?.id}
              tags={product.tags}
              duration={product.duration}
              size="xs"
              iconOnly
            />
          </div>
        </div>

        {/* 動画再生モーダル（通常版と共有） */}
        {showVideoModal && primaryVideo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={handleCloseVideoModal}
          >
            <button
              type="button"
              onClick={handleCloseVideoModal}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
              aria-label={t('close')}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div
              className="relative w-full max-w-4xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                src={primaryVideo.url}
                controls
                autoPlay
                className="w-full rounded-lg"
                style={{ maxHeight: '80vh' }}
              >
                {t('videoNotSupported')}
              </video>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden flex flex-col hover:shadow-2xl transition-shadow duration-300 border border-gray-700">
      <div className="relative h-72 bg-gradient-to-br from-gray-700 to-gray-800">
        <div className="relative block h-full group">
          {/* 画像クリックでフルサイズ表示 */}
          <button
            type="button"
            onClick={handleImageClick}
            className="absolute inset-0 z-10 cursor-zoom-in focus:outline-none"
            aria-label={t('enlargeImage')}
          />
          <Image
            src={imgSrc}
            alt={generateAltText(product)}
            fill
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${isUncensored ? 'blur-[3px]' : ''}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            onError={handleImageError}
            priority={false}
            quality={80}
          />
          {/* 動画再生ボタン */}
          {hasSampleVideo && (
            <button
              type="button"
              onClick={handleVideoClick}
              className="absolute top-2 left-2 z-20 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full transition-all hover:scale-110 flex items-center gap-1"
              aria-label={t('playSampleVideo')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          {/* ズームアイコン */}
          {hasValidImageUrl && !hasError && imgSrc !== PLACEHOLDER_IMAGE && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          )}
          {/* No Image オーバーレイ */}
          {(hasError || imgSrc === PLACEHOLDER_IMAGE || !hasValidImageUrl) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
              <div className="text-7xl mb-3 text-gray-500">📷</div>
              <span className="inline-block px-4 py-1.5 bg-gray-600 text-white text-xs font-bold rounded-full shadow-md">
                NO IMAGE
              </span>
            </div>
          )}
        </div>
        {product.isFuture && (
          <div className="absolute top-4 left-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white shadow-lg">
              {t('comingSoon')}
            </span>
          </div>
        )}
        {product.isNew && !product.isFuture && (
          <div className="absolute top-4 left-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-600 text-white shadow-lg">
              NEW
            </span>
          </div>
        )}
        {product.productType === 'dvd' && (
          <div className="absolute top-4 left-4" style={{ marginTop: product.isFuture || product.isNew ? '28px' : '0' }}>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white shadow-lg">
              DVD
            </span>
          </div>
        )}
        {product.productType === 'monthly' && (
          <div className="absolute top-4 left-4" style={{ marginTop: product.isFuture || product.isNew ? '28px' : '0' }}>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-lg">
              {t('monthly')}
            </span>
          </div>
        )}
        <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-20">
          <div className="bg-gray-700 rounded-full shadow-md">
            <FavoriteButton type="product" id={product.id} />
          </div>
          <ViewedButton
            productId={product.id}
            title={product.title}
            imageUrl={product.imageUrl ?? null}
            aspName={product.providerLabel ?? product.provider ?? 'unknown'}
            performerName={product.actressName ?? product.performers?.[0]?.name}
            performerId={product.actressId ?? product.performers?.[0]?.id}
            tags={product.tags}
            duration={product.duration}
            size="sm"
            iconOnly
            className="shadow-md"
          />
        </div>
        {/* 人気ランキングバッジ */}
        {rankPosition && rankPosition <= 10 && (
          <div className="absolute top-14 right-4 z-20">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full shadow-lg ${
              rankPosition === 1 ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black' :
              rankPosition === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-black' :
              rankPosition === 3 ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white' :
              'bg-gray-800 text-white border border-gray-600'
            }`}>
              {rankPosition <= 3 ? `🏆 ${rankPosition}位` : `${rankPosition}位`}
            </span>
          </div>
        )}
        {product.discount && !product.salePrice && (
          <span className="absolute bottom-4 right-4 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">
            {product.discount}%OFF
          </span>
        )}
        {/* 画像上の価格バッジ（Above-the-fold CTA強化） */}
        {(product.salePrice || product.price > 0) && (() => {
          // A/Bテスト: 価格表示スタイル
          const priceVariant = getVariant('priceDisplayStyle');
          const isEmphasized = priceVariant === 'emphasized';
          // A/Bテスト: セールカウントダウンスタイル
          const countdownVariant = getVariant('saleCountdownStyle');
          const isAnimated = countdownVariant === 'animated';

          return (
            <div className="absolute bottom-4 left-4 bg-gray-900/95 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg border border-gray-700">
              {product.salePrice ? (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold text-red-300 ${isEmphasized ? 'text-base' : 'text-sm'}`}>
                      {formatPrice(product.salePrice, product.currency)}
                    </span>
                    {product.discount && (
                      <span className={`font-bold text-red-300 bg-red-900/50 px-1 py-0.5 rounded ${isEmphasized ? 'text-xs' : 'text-[10px]'}`}>
                        -{product.discount}%
                      </span>
                    )}
                  </div>
                  {/* セール終了日カウントダウン */}
                  {product.saleEndAt && (() => {
                    const endDate = new Date(product.saleEndAt);
                    const now = new Date();
                    const diffMs = endDate.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    if (diffDays <= 0) return null;
                    if (diffDays <= 3) {
                      return (
                        <span className={`text-[10px] font-bold text-yellow-300 ${isAnimated ? 'animate-pulse' : ''}`}>
                          {diffDays === 1 ? '⏰ ' + t('saleTomorrow') : `⏰ ${t('saleEndsIn', { days: diffDays })}`}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <span className={`font-bold text-white ${isEmphasized ? 'text-base' : 'text-sm'}`}>
                  {formatPrice(product.price, product.currency)}
                </span>
              )}
            </div>
          );
        })()}
      </div>

      <div className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 flex-1">
        <div>
          <div className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1 truncate">
            {product.actressId ? (
              <Link
                href={`/${locale}/actress/${product.actressId}`}
                className="text-rose-400/80 hover:text-rose-400 hover:underline underline-offset-2 transition-colors font-medium truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {product.actressName ?? t('performerInfo')}
              </Link>
            ) : product.performers && product.performers.length > 0 ? (
              <span className="truncate">
                {product.performers.slice(0, 2).map((performer, index) => (
                  <span key={performer.id}>
                    <Link
                      href={`/${locale}/actress/${performer.id}`}
                      className="text-rose-400/80 hover:text-rose-400 hover:underline underline-offset-2 transition-colors font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {performer.name}
                    </Link>
                    {index < Math.min(product.performers!.length, 2) - 1 && <span className="mx-0.5 text-gray-500">/</span>}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-gray-500 truncate">{product.actressName ?? t('performerInfo')}</span>
            )}
            <span className="text-gray-600 shrink-0">|</span>
            <span className="text-gray-500 shrink-0">{product.releaseDate ?? t('releaseDateTbd')}</span>
          </div>
          <Link href={`/${locale}/products/${product.id}`}>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">
              {product.normalizedProductId || product.id}
            </p>
            <h3 className="font-semibold text-sm sm:text-base leading-tight mt-0.5 line-clamp-2 text-white hover:text-gray-300">
              {product.title}
            </h3>
          </Link>
        </div>

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.tags.slice(0, 3).map((tag) => (
              <Link
                key={tag}
                href={getTagFilterUrl(tag)}
                className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 hover:bg-rose-600 hover:text-white transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {(product.rating || product.duration) && (
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400">
            {product.rating && (
              <StarRating
                rating={product.rating}
                reviewCount={product.reviewCount}
                size="sm"
                showCount={true}
              />
            )}
            {product.duration && <span className="shrink-0">・{product.duration}分</span>}
          </div>
        )}

        <div className="mt-auto space-y-1.5">
          {/* 価格表示: セール中の場合は通常価格を取り消し線、セール価格を強調表示 */}
          {product.salePrice && product.regularPrice ? (
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-base sm:text-lg font-semibold text-red-500">
                  {formatPrice(product.salePrice, product.currency)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 line-through">
                  {formatPrice(product.regularPrice, product.currency)}
                </p>
                {product.discount && (
                  <span className="text-[10px] font-bold text-red-300 bg-red-900/50 px-1 py-0.5 rounded">
                    -{product.discount}%
                  </span>
                )}
              </div>
            </div>
          ) : product.price > 0 ? (
            <p className="text-base sm:text-lg font-semibold text-white">
              {formatPrice(product.price, product.currency)}
            </p>
          ) : isSubscriptionSite(product.provider) ? (
            <p className="text-sm font-semibold text-rose-500">
              {t('subscriptionOnly')}
            </p>
          ) : null}
          {/* FANZA商品は規約上adult側では購入リンクを非表示 */}
          {(() => {
            const affiliateUrl = getAffiliateUrl(product.affiliateUrl);
            if (!affiliateUrl || product.provider === 'fanza') return null;
            const isSale = !!product.salePrice;

            // A/Bテスト: CTAボタンテキストのバリエーション
            const ctaVariant = getVariant('ctaButtonText');
            const getCtaText = () => {
              const provider = product.providerLabel;
              if (isSale) {
                switch (ctaVariant) {
                  case 'urgency': return `${provider}で今すぐ購入`;
                  case 'action': return `${provider}でお得にゲット`;
                  default: return `${provider}でお得に購入`;
                }
              } else {
                switch (ctaVariant) {
                  case 'urgency': return `${provider}で今すぐ見る`;
                  case 'action': return `${provider}をチェック`;
                  default: return `${provider}で見る`;
                }
              }
            };

            const handleCtaClick = () => {
              trackCtaClick('ctaButtonText', product.id, {
                is_sale: isSale,
                provider: product.provider,
              });
            };

            return (
              <a
                href={affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={handleCtaClick}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg w-full px-3 py-2.5 text-sm font-bold shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all ${
                  isSale
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700'
                    : 'bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700'
                }`}
                title={`${product.providerLabel}で購入`}
                aria-label={`${product.providerLabel}で購入（外部リンク）`}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="truncate">
                  {getCtaText()}
                </span>
              </a>
            );
          })()}
        </div>
      </div>

      {/* フルサイズ画像モーダル */}
      <ImageLightbox
        images={allImages}
        initialIndex={modalImageIndex}
        isOpen={showModal}
        onClose={handleCloseModal}
        alt={generateAltText(product)}
        detailsUrl={`/${locale}/products/${product.id}`}
      />

      {/* 動画再生モーダル */}
      {showVideoModal && primaryVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={handleCloseVideoModal}
        >
          <button
            type="button"
            onClick={handleCloseVideoModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
            aria-label={t('close')}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div
            className="relative w-full max-w-4xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={primaryVideo.url}
              controls
              autoPlay
              className="w-full rounded-lg"
              style={{ maxHeight: '80vh' }}
            >
              {t('videoNotSupported')}
            </video>
          </div>
        </div>
      )}
    </div>
  );
}
