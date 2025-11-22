/**
 * Image URL utility functions
 */

/**
 * Normalize protocol-relative URLs to absolute URLs
 * Converts URLs starting with "//" to "https://"
 * @param url - The URL to normalize (can be null or undefined)
 * @returns Normalized URL or fallback placeholder
 */
export function normalizeImageUrl(url: string | null | undefined): string {
  // Return placeholder if URL is missing
  if (!url || url.trim() === '') {
    return 'https://placehold.co/400x520/052e16/ffffff?text=No+Image';
  }

  // Convert protocol-relative URLs (//domain.com/path) to absolute URLs (https://domain.com/path)
  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  // Return URL as-is if already absolute
  return url;
}

/**
 * Get a fallback image URL for product cards
 * @returns Placeholder image URL
 */
export function getFallbackImageUrl(): string {
  return 'https://placehold.co/400x520/052e16/ffffff?text=No+Image';
}
