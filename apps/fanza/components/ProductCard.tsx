'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { Product } from '@/types/product';
import { normalizeImageUrl, getFullSizeImageUrl, isDtiUncensoredSite, isSubscriptionSite } from '@/lib/image-utils';
import { generateAltText } from '@/lib/seo-utils';
import { formatPrice } from '@/lib/utils/subscription';
import { providerMeta, type ProviderId } from '@/lib/providers';
import FavoriteButton from './FavoriteButton';
import ImageLightbox from './ImageLightbox';

interface ProductCardProps {
  product: Product;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x560/1f2937/ffffff?text=NO+IMAGE';

export default function ProductCard({ product }: ProductCardProps) {
  const locale = useLocale();
  const t = useTranslations('productCard');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasValidImageUrl = product.imageUrl && product.imageUrl.trim() !== '';
  const [imgSrc, setImgSrc] = useState(hasValidImageUrl ? normalizeImageUrl(product.imageUrl) : PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);

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
            quality={75}
          />
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
        <div className="absolute top-4 right-4 bg-gray-700 rounded-full shadow-md">
          <FavoriteButton type="product" id={product.id} />
        </div>
        {product.discount && !product.salePrice && (
          <span className="absolute bottom-4 right-4 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">
            {product.discount}%OFF
          </span>
        )}
      </div>

      <div className="p-6 flex flex-col gap-4 flex-1">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400 flex items-center gap-1 flex-wrap">
            {product.actressId ? (
              <Link
                href={`/${locale}/actress/${product.actressId}`}
                className="text-rose-400/80 hover:text-rose-400 hover:underline underline-offset-2 transition-colors font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {product.actressName ?? t('performerInfo')}
              </Link>
            ) : product.performers && product.performers.length > 0 ? (
              product.performers.slice(0, 3).map((performer, index) => (
                <span key={performer.id}>
                  <Link
                    href={`/${locale}/actress/${performer.id}`}
                    className="text-rose-400/80 hover:text-rose-400 hover:underline underline-offset-2 transition-colors font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {performer.name}
                  </Link>
                  {index < Math.min(product.performers!.length, 3) - 1 && <span className="mx-0.5 text-gray-500">/</span>}
                </span>
              ))
            ) : (
              <span className="text-gray-500">{product.actressName ?? t('performerInfo')}</span>
            )}
            <span className="mx-1 text-gray-600">|</span>
            <span className="text-gray-500">{product.releaseDate ?? t('releaseDateTbd')}</span>
          </div>
          <Link href={`/${locale}/products/${product.id}`}>
            <div className="text-xs text-gray-500 mt-1">
              <p>{t('productId')}: {product.normalizedProductId || product.id}</p>
              {product.originalProductId && (
                <p>{t('manufacturerId')}: {product.originalProductId}</p>
              )}
            </div>
            <h3 className="font-semibold text-xl leading-tight mt-1 line-clamp-2 text-white hover:text-gray-300">
              {product.title}
            </h3>
          </Link>
          <p className="text-sm text-gray-400 mt-2 line-clamp-3">{product.description}</p>
        </div>

        {product.reviewHighlight && (
          <p className="text-sm text-gray-200 bg-gray-700 rounded-xl px-4 py-2 italic">
            &ldquo;{product.reviewHighlight}&rdquo;
          </p>
        )}

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.tags.slice(0, 4).map((tag) => (
              <Link
                key={tag}
                href={getTagFilterUrl(tag)}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-700 text-gray-300 hover:bg-rose-600 hover:text-white transition-all border border-gray-600 hover:border-rose-500 cursor-pointer group"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  {tag}
                </span>
              </Link>
            ))}
          </div>
        )}

        {(product.rating || product.duration) && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {product.rating && (
              <>
                <span className="font-semibold text-white">{product.rating.toFixed(1)}</span>
                <span>({product.reviewCount ?? 0}{t('reviews')})</span>
              </>
            )}
            {product.duration && <span>・ {product.duration}{t('minutes')}</span>}
          </div>
        )}

        <div className="mt-auto space-y-2">
          {/* 価格表示: セール中の場合は通常価格を取り消し線、セール価格を強調表示 */}
          {product.salePrice && product.regularPrice ? (
            <div>
              <Link
                href={getAspFilterUrl(product.provider)}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-medium hover:underline underline-offset-2 transition-colors ${
                  providerMeta[product.provider as ProviderId]?.textClass || 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {product.providerLabel}
              </Link>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-red-500">
                  {formatPrice(product.salePrice, product.currency)}
                </p>
                <p className="text-sm text-gray-500 line-through">
                  {formatPrice(product.regularPrice, product.currency)}
                </p>
                {product.discount && (
                  <span className="text-xs font-bold text-red-400 bg-red-900/50 px-1.5 py-0.5 rounded">
                    {product.discount}%OFF
                  </span>
                )}
              </div>
            </div>
          ) : product.price > 0 ? (
            <div>
              <Link
                href={getAspFilterUrl(product.provider)}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-medium hover:underline underline-offset-2 transition-colors ${
                  providerMeta[product.provider as ProviderId]?.textClass || 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {product.providerLabel}
              </Link>
              <p className="text-2xl font-semibold text-white">
                {formatPrice(product.price, product.currency)}
              </p>
            </div>
          ) : isSubscriptionSite(product.provider) ? (
            <div>
              <Link
                href={getAspFilterUrl(product.provider)}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-medium hover:underline underline-offset-2 transition-colors ${
                  providerMeta[product.provider as ProviderId]?.textClass || 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {product.providerLabel}
              </Link>
              <p className="text-lg font-semibold text-rose-500">
                {t('subscriptionOnly')}
              </p>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Link
              href={`/${locale}/products/${product.id}`}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-3 py-2 hover:bg-gray-800 active:scale-95 transition-transform"
              title={t('viewDetails')}
              aria-label={t('viewDetails')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </Link>
            {product.affiliateUrl && (
              <a
                href={product.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-600 text-white px-3 py-2 text-sm font-semibold hover:bg-rose-700 active:scale-95 transition-transform"
                title={`${product.providerLabel}で購入`}
                aria-label={`${product.providerLabel}で購入（外部リンク）`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
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
    </div>
  );
}
