import Image from 'next/image';
import { normalizeImageUrl } from '../lib/image-utils';
import { getTranslation, fanzaNewReleasesTranslations } from '../lib/translations';

const FANZA_SITE_URL = 'https://www.f.adult-v.com';

interface FanzaProduct {
  id: string | number;
  title: string;
  imageUrl: string | null;
  salePrice?: number | null;
  price?: number;
  discount?: number | null;
  releaseDate?: string | null;
}

interface FanzaNewReleasesSectionProps {
  locale?: string;
  className?: string;
  products: FanzaProduct[];
}

/**
 * FANZA新作ピックアップセクション
 * apps/webのトップページに表示し、FANZA専門サイトへの導線を強化
 */
export function FanzaNewReleasesSection({ locale = 'ja', className = '', products }: FanzaNewReleasesSectionProps) {
  const t = getTranslation(fanzaNewReleasesTranslations, locale);

  // 商品がない場合は表示しない
  if (products.length === 0) {
    return null;
  }

  const fanzaSiteUrl = `${FANZA_SITE_URL}?hl=${locale}`;

  return (
    <section className={`py-4 sm:py-6 ${className}`}>
      <div className="container mx-auto px-3 sm:px-4">
        {/* ヘッダー */}
        <div className="mb-3 flex items-center justify-between sm:mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500 sm:h-10 sm:w-10">
              <span className="text-lg font-bold text-white sm:text-xl">F</span>
            </div>
            <h2 className="text-lg font-bold text-white sm:text-xl">{t.title}</h2>
          </div>
          <a
            href={fanzaSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-fuchsia-400 transition-colors hover:text-fuchsia-300 sm:text-sm"
          >
            {t.viewMore}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>

        {/* 商品グリッド */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
          {products.slice(0, 8).map((product, index) => (
            <a
              key={product['id']}
              href={`${FANZA_SITE_URL}/products/${product['id']}?hl=${locale}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all hover:bg-white/5 hover:ring-1 hover:ring-fuchsia-400/20"
            >
              <div className="relative" style={{ aspectRatio: '2/3' }}>
                {product.imageUrl ? (
                  <Image
                    src={normalizeImageUrl(product.imageUrl)}
                    alt={product['title']}
                    fill
                    sizes="(max-width: 768px) 25vw, 12.5vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    loading={index < 4 ? undefined : 'lazy'}
                    priority={index < 4}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gray-700">
                    <svg className="h-8 w-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                {/* セールバッジ */}
                {product.salePrice && (
                  <div className="absolute top-1 left-1 flex gap-1">
                    <span className="rounded bg-red-600 px-1 py-0.5 text-[8px] font-bold text-white sm:text-[10px]">
                      {t.sale}
                    </span>
                    {product['discount'] && product['discount'] >= 30 && (
                      <span className="rounded bg-linear-to-r from-yellow-400 to-orange-500 px-1 py-0.5 text-[8px] font-bold text-black sm:text-[10px]">
                        -{product['discount']}%
                      </span>
                    )}
                  </div>
                )}
                {/* ホバーオーバーレイ */}
                <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/80 via-transparent to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-md bg-fuchsia-500/80 px-1.5 py-0.5 text-[10px] font-medium text-white sm:text-xs">
                    FANZAで見る
                  </span>
                </div>
              </div>
              <div className="p-1.5">
                <p className="line-clamp-2 text-[10px] font-medium text-gray-200 transition-colors group-hover:text-fuchsia-300 sm:text-xs">
                  {product['title']}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* FANZAサイトへのCTA */}
        <div className="mt-3 sm:mt-4">
          <a
            href={fanzaSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg bg-fuchsia-500 p-3 text-center text-sm font-medium text-white shadow transition-all hover:bg-fuchsia-400 hover:shadow-md"
          >
            <span className="flex items-center justify-center gap-2">
              FANZA専門サイトで全作品を見る
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

export default FanzaNewReleasesSection;
