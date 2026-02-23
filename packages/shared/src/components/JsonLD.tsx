/**
 * Safe JSON-LD script component for structured data
 */

interface JsonLDProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLD({ data }: JsonLDProps) {
  const cleaned = Array.isArray(data) ? data.filter(Boolean) : data;
  if (Array.isArray(cleaned) && cleaned.length === 0) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(cleaned) }} />;
}
