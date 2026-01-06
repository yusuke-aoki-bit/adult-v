/**
 * Structured Data (JSON-LD) generation utilities for SEO
 */

import { localizedHref } from '../i18n';

export interface ProductStructuredData {
  id: number;
  title: string;
  description: string | null;
  releaseDate: Date | null;
  duration: number | null;
  defaultThumbnailUrl: string | null;
  performers: Array<{
    id: number;
    name: string;
  }>;
  tags: Array<{
    id: number;
    name: string;
  }>;
  productSources: Array<{
    aspName: string;
    price: number | null;
    affiliateUrl: string;
  }>;
}

export interface PerformerStructuredData {
  id: number;
  name: string;
  profileImageUrl: string | null;
}

/**
 * Generate JSON-LD for a product/video
 */
export function generateProductJsonLd(
  product: ProductStructuredData,
  locale: string = 'ja'
): string {
  const baseUrl = process.env['NEXT_PUBLIC_BASE_URL'] || 'https://miraikakaku.com';
  const productUrl = `${baseUrl}${localizedHref(`/products/${product['id']}`, locale)}`;

  // Find the lowest price from all sources
  const prices = product.productSources
    .map(s => s.price)
    .filter((price): price is number => price !== null);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: product['title'],
    description: product['description'] || product['title'],
    uploadDate: product['releaseDate']?.toISOString(),
    thumbnailUrl: product['defaultThumbnailUrl'],
    duration: product['duration'] ? `PT${product['duration']}M` : undefined,
    contentUrl: productUrl,
    // Actors
    actor: product.performers.map(performer => ({
      '@type': 'Person',
      name: performer['name'],
      url: `${baseUrl}${localizedHref(`/performers/${performer['id']}`, locale)}`,
    })),
    // Tags as keywords
    keywords: product.tags.map(tag => tag['name']).join(', '),
    // Offers - aggregate from all sources
    offers: minPrice ? {
      '@type': 'AggregateOffer',
      priceCurrency: 'JPY',
      lowPrice: minPrice,
      offerCount: product.productSources.length,
      offers: product.productSources
        .filter(s => s.price !== null)
        .map(source => ({
          '@type': 'Offer',
          price: source.price,
          priceCurrency: 'JPY',
          seller: {
            '@type': 'Organization',
            name: source.aspName,
          },
          url: source.affiliateUrl,
        })),
    } : undefined,
    // Breadcrumbs
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${baseUrl}${localizedHref('/', locale)}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: product['title'],
          item: productUrl,
        },
      ],
    },
  };

  // Remove undefined values
  const cleanedJsonLd = JSON.parse(JSON.stringify(jsonLd));

  return JSON.stringify(cleanedJsonLd);
}

/**
 * Generate JSON-LD for a performer/actress
 */
export function generatePerformerJsonLd(
  performer: PerformerStructuredData,
  locale: string = 'ja'
): string {
  const baseUrl = process.env['NEXT_PUBLIC_BASE_URL'] || 'https://miraikakaku.com';
  const performerUrl = `${baseUrl}${localizedHref(`/performers/${performer['id']}`, locale)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: performer['name'],
    image: performer['profileImageUrl'],
    url: performerUrl,
    // Breadcrumbs
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${baseUrl}${localizedHref('/', locale)}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Performers',
          item: `${baseUrl}${localizedHref('/performers', locale)}`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: performer['name'],
          item: performerUrl,
        },
      ],
    },
  };

  return JSON.stringify(jsonLd);
}

/**
 * Generate JSON-LD for a list page (e.g., homepage, category page)
 */
export function generateListPageJsonLd(
  title: string,
  description: string,
  locale: string = 'ja'
): string {
  const baseUrl = process.env['NEXT_PUBLIC_BASE_URL'] || 'https://miraikakaku.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: title,
    description: description,
    url: `${baseUrl}${localizedHref('/', locale)}`,
  };

  return JSON.stringify(jsonLd);
}

/**
 * Generate JSON-LD for organization
 */
export function generateOrganizationJsonLd(locale: string = 'ja'): string {
  const baseUrl = process.env['NEXT_PUBLIC_BASE_URL'] || 'https://miraikakaku.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Miraikakaku',
    url: `${baseUrl}${localizedHref('/', locale)}`,
    logo: `${baseUrl}/logo.png`,
    sameAs: [
      // Add social media links if available
    ],
  };

  return JSON.stringify(jsonLd);
}
