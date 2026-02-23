/**
 * Safe JSON-LD script component for structured data
 */

interface JsonLDProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLD({ data }: JsonLDProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
