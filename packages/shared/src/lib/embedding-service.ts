/**
 * OpenAI Embedding Service
 * セマンティック検索用のベクトル生成サービス
 */

import { createHash } from 'crypto';

// OpenAI API設定
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536次元
const MAX_TOKENS = 8191; // text-embedding-3-smallの最大トークン数

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
 * 単一テキストのembeddingを生成
 */
export async function generateEmbedding(
  text: string,
  apiKey?: string
): Promise<EmbeddingResult> {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  // テキストを適切な長さにトリミング
  const truncatedText = text.slice(0, MAX_TOKENS * 4); // 概算で4文字/トークン

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncatedText,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  return {
    embedding: data.data[0].embedding,
    textHash: generateTextHash(truncatedText),
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}

/**
 * 複数テキストのembeddingをバッチ生成
 * OpenAI APIは1リクエストで複数テキストをサポート
 */
export async function generateEmbeddingBatch(
  texts: string[],
  apiKey?: string
): Promise<BatchEmbeddingResult> {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  if (texts.length === 0) {
    return {
      embeddings: [],
      model: EMBEDDING_MODEL,
      usage: { promptTokens: 0, totalTokens: 0 },
    };
  }

  // 各テキストをトリミング
  const truncatedTexts = texts.map((t) => t.slice(0, MAX_TOKENS * 4));

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: truncatedTexts,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  return {
    embeddings: data.data.map((item: { index: number; embedding: number[] }) => ({
      index: item.index,
      embedding: item.embedding,
      textHash: generateTextHash(truncatedTexts[item.index]),
    })),
    model: data.model,
    usage: {
      promptTokens: data.usage.prompt_tokens,
      totalTokens: data.usage.total_tokens,
    },
  };
}

/**
 * クエリテキストのembeddingを生成（検索用）
 */
export async function generateQueryEmbedding(
  query: string,
  apiKey?: string
): Promise<number[]> {
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
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
