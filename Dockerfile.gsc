# Cloud Run Jobs用 GSCデータ取得Dockerfile
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/crawlers/package.json ./packages/crawlers/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source
COPY packages/crawlers/ ./packages/crawlers/
COPY packages/database/ ./packages/database/
COPY packages/shared/ ./packages/shared/
COPY tsconfig.json ./

WORKDIR /app/packages/crawlers

# GSC_TASK環境変数で実行するタスクを切り替え
# migrate: マイグレーション実行
# fetch: GSCデータ取得（デフォルト）
ENV GSC_TASK=fetch

CMD ["sh", "-c", "if [ \"$GSC_TASK\" = \"migrate\" ]; then npx tsx src/seo/migrate-seo-tables.ts; else npx tsx src/seo/fetch-gsc-data.ts; fi"]
