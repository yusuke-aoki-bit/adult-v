/**
 * Image URL utility functions
 */

const PLACEHOLDER_URL = 'https://placehold.co/400x520/052e16/ffffff?text=No+Image';

/**
 * Extract image URL from broken HTML string (e.g., containing <img src="...">)
 * @param url - The potentially malformed URL string
 * @returns Extracted URL or null if not found
 */
function extractImageUrlFromHtml(url: string): string | null {
  // Pattern to extract src attribute from img tag
  const srcMatch = url.match(/src=["']([^"']+)["']/);
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1];
  }
  return null;
}

/**
 * Check if URL is valid (not containing HTML tags or invalid format)
 * @param url - The URL to validate
 * @returns true if URL is valid
 */
function isValidUrl(url: string): boolean {
  // Reject URLs containing HTML tags
  if (url.includes('<') || url.includes('>')) {
    return false;
  }
  // Basic URL format check
  try {
    const parsed = new URL(url.startsWith('//') ? `https:${url}` : url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize protocol-relative URLs to absolute URLs
 * Converts URLs starting with "//" to "https://"
 * Also validates URLs and returns placeholder for invalid ones
 * @param url - The URL to normalize (can be null or undefined)
 * @returns Normalized URL or fallback placeholder
 */
export function normalizeImageUrl(url: string | null | undefined): string {
  // Return placeholder if URL is missing
  if (!url || url.trim() === '') {
    return PLACEHOLDER_URL;
  }

  let processedUrl = url;

  // Try to extract URL from HTML tags if present (e.g., broken crawler data)
  if (url.includes('<') || url.includes('>')) {
    const extracted = extractImageUrlFromHtml(url);
    if (extracted && isValidUrl(extracted)) {
      processedUrl = extracted;
    } else {
      return PLACEHOLDER_URL;
    }
  }

  // Return placeholder if URL is invalid
  if (!isValidUrl(processedUrl)) {
    return PLACEHOLDER_URL;
  }

  // Convert protocol-relative URLs (//domain.com/path) to absolute URLs (https://domain.com/path)
  if (processedUrl.startsWith('//')) {
    return `https:${processedUrl}`;
  }

  // Return URL as-is if already absolute
  return processedUrl;
}

/**
 * Get a fallback image URL for product cards
 * @returns Placeholder image URL
 */
export function getFallbackImageUrl(): string {
  return 'https://placehold.co/400x520/052e16/ffffff?text=No+Image';
}
