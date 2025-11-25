#!/bin/bash

# Cloud Run Job script for DUGA image crawler
# Environment variables expected:
#   DATABASE_URL - PostgreSQL connection string
#   BATCH_OFFSET - Starting offset (e.g., 0, 100, 200, ...)
#   BATCH_LIMIT - Number of products per batch (default: 100)

set -e

LIMIT=${BATCH_LIMIT:-100}
OFFSET=${BATCH_OFFSET:-0}

echo "🖼️  DUGA Image Crawler - Cloud Run Job"
echo "========================================"
echo "Batch limit: $LIMIT"
echo "Batch offset: $OFFSET"
echo "========================================"
echo ""

# Run the crawler
npx tsx scripts/crawlers/crawl-duga-images.ts --limit "$LIMIT" --offset "$OFFSET"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Batch completed successfully!"
else
  echo "❌ Batch failed with exit code $EXIT_CODE"
  exit $EXIT_CODE
fi
