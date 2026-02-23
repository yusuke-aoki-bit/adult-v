/**
 * Gemini Embedding Service
 * セマンティック検索用のベクトル生成サービス
 * Gemini text-embedding-004 を使用（768次元）
 * OpenAI APIキー不要 - 既存のGEMINI_API_KEYで動作
 */

import { createHash } from 'crypto';

// Gemini Embedding API設定
const GEMINI_API_KEY = process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || '';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const GEMINI_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
const GEMINI_BATCH_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;

export interface EmbeddingResult {
  embedding: number[];
  textHash: string;
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface BatchEmbeddingResult {
  embeddings: Array<{
    index: number;
    embedding: number[];
    textHash: string;
  }>;
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * テキストのSHA256ハッシュを生成（変更検出用）
 */
export function generateTextHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * 商品のembedding用テキストを生成
 */
export function buildProductEmbeddingText(product: {
  title: string;
  description?: string | null;
  performers?: string[];
  tags?: string[];
  maker?: string | null;
  series?: string | null;
}): string {
  const parts: string[] = [];

  // タイトル（最重要）
  if (product.title) {
    parts.push(`タイトル: ${product.title}`);
  }

  // 出演者
  if (product.performers && product.performers.length > 0) {
    parts.push(`出演者: ${product.performers.join(', ')}`);
  }

  // メーカー・シリーズ
  if (product.maker) {
    parts.push(`メーカー: ${product.maker}`);
  }
  if (product.series) {
    parts.push(`シリーズ: ${product.series}`);
  }

  // タグ
  if (product.tags && product.tags.length > 0) {
    parts.push(`ジャンル: ${product.tags.join(', ')}`);
  }

  // 説明文（要約）
  if (product.description) {
    const shortDesc = product.description.slice(0, 500);
    parts.push(`説明: ${shortDesc}`);
  }

  return parts.join('\n');
}

/**
 * 女優のembedding用テキストを生成
 */
export function buildPerformerEmbeddingText(performer: {
  name: string;
  nameKana?: string | null;
  bio?: string | null;
  height?: number | null;
  bust?: number | null;
  cup?: string | null;
  birthplace?: string | null;
  hobbies?: string | null;
  genres?: string[];
}): string {
  const parts: string[] = [];

  // 名前
  parts.push(`名前: ${performer.name}`);
  if (performer.nameKana) {
    parts.push(`読み: ${performer.nameKana}`);
  }

  // 身体情報
  const bodyParts: string[] = [];
  if (performer.height) bodyParts.push(`${performer.height}cm`);
  if (performer.bust) bodyParts.push(`B${performer.bust}`);
  if (performer.cup) bodyParts.push(`${performer.cup}カップ`);
  if (bodyParts.length > 0) {
    parts.push(`スタイル: ${bodyParts.join(' ')}`);
  }

  // 出身地・趣味
  if (performer.birthplace) {
    parts.push(`出身: ${performer.birthplace}`);
  }
  if (performer.hobbies) {
    parts.push(`趣味: ${performer.hobbies}`);
  }

  // ジャンル
  if (performer.genres && performer.genres.length > 0) {
    parts.push(`得意ジャンル: ${performer.genres.join(', ')}`);
  }

  // 自己紹介
  if (performer.bio) {
    const shortBio = performer.bio.slice(0, 300);
    parts.push(`プロフィール: ${shortBio}`);
  }

  return parts.join('\n');
}

/**
 * Gemini Embedding APIを呼び出し（単一テキスト）
 */
export async function generateEmbedding(text: string, _apiKey?: string): Promise<EmbeddingResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // テキストを適切な長さにトリミング（Geminiは最大10,000トークン）
  const truncatedText = text.slice(0, 10000);

  const response = await fetch(`${GEMINI_EMBED_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text: truncatedText }],
      },
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini Embedding API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    embedding: { values: number[] };
  };

  return {
    embedding: data.embedding.values,
    textHash: generateTextHash(truncatedText),
    model: EMBEDDING_MODEL,
    usage: {
      promptTokens: Math.ceil(truncatedText.length / 4),
      totalTokens: Math.ceil(truncatedText.length / 4),
    },
  };
}

/**
 * 複数テキストのembeddingをバッチ生成
 * Gemini batchEmbedContents APIを使用
 */
export async function generateEmbeddingBatch(texts: string[], _apiKey?: string): Promise<BatchEmbeddingResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  if (texts.length === 0) {
    return {
      embeddings: [],
      model: EMBEDDING_MODEL,
      usage: { promptTokens: 0, totalTokens: 0 },
    };
  }

  // 各テキストをトリミング
  const truncatedTexts = texts.map((t) => t.slice(0, 10000));

  const response = await fetch(`${GEMINI_BATCH_EMBED_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: truncatedTexts.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: {
          parts: [{ text }],
        },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini Batch Embedding API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    embeddings: Array<{ values: number[] }>;
  };

  let totalChars = 0;
  for (const t of truncatedTexts) totalChars += t.length;

  return {
    embeddings: data.embeddings.map((item, index) => ({
      index,
      embedding: item.values,
      textHash: generateTextHash(truncatedTexts[index]!),
    })),
    model: EMBEDDING_MODEL,
    usage: {
      promptTokens: Math.ceil(totalChars / 4),
      totalTokens: Math.ceil(totalChars / 4),
    },
  };
}

/**
 * クエリテキストのembeddingを生成（検索用）
 */
export async function generateQueryEmbedding(query: string, apiKey?: string): Promise<number[]> {
  const result = await generateEmbedding(query, apiKey);
  return result.embedding;
}

/**
 * コサイン類似度を計算（クライアントサイド用）
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** エクスポート: embedding次元数 */
export const EMBEDDING_DIMS = EMBEDDING_DIMENSIONS;
