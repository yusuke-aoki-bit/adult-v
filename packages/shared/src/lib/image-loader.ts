/**
 * Custom image loader using wsrv.nl proxy for WebP conversion and resizing.
 * Avoids Next.js built-in image optimization which is slow on Firebase Cloud Run.
 * @see https://wsrv.nl/docs/
 */
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  // Local/relative images: return as-is
  if (src.startsWith('/') || src.startsWith('data:')) {
    return src;
  }

  // External images: proxy through wsrv.nl for optimization
  const params = new URLSearchParams();
  params.set('url', src);
  params.set('w', String(width));
  params.set('q', String(quality || 75));
  params.set('output', 'webp');
  // Add cache buster based on width for CDN
  params.set('t', 'fit');

  return `https://wsrv.nl/?${params.toString()}`;
}
