import React from 'react';

interface StructuredDataProps {
  data: string;
}

/**
 * Component to embed JSON-LD structured data in the page
 */
export default function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: data }}
    />
  );
}
