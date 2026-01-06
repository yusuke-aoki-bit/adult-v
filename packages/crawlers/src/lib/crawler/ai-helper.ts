/**
 * Crawler AI Helper
 *
 * クローラー向けAI機能の統合ヘルパー
 * google-apis.tsの関数をラップし、クローラーでの使いやすいインターフェースを提供
 */

import {
  extractProductTags,
  translateProduct,
  generateProductDescription,
  type ProductTranslation,
  type GeneratedDescription,
} from '../google-apis';

// ============================================================
// Types
// ============================================================

export interface ExtractedTags {
  genres: string[];
  attributes: string[];
  plays: string[];
  situations: string[];
}

export interface AIProcessingResult {
  tags?: ExtractedTags;
  translations?: ProductTranslation;
  description?: GeneratedDescription;
  errors: string[];
}

export interface ProductAIInput {
  title: string;
  description?: string;
  performers?: string[];
  genres?: string[];
  maker?: string;
  releaseDate?: string;
}

export interface CrawlerAIOptions {
  /** タグ抽出を有効化 (default: true) */
  extractTags?: boolean;
  /** 翻訳を有効化 (default: true) */
  translate?: boolean;
  /** 説明文生成を有効化 (default: false) */
  generateDescription?: boolean;
  /** エラー時にスローするか (default: false) */
  throwOnError?: boolean;
}

// ============================================================
// CrawlerAIHelper Class
// ============================================================

/**
 * クローラー向けAIヘルパークラス
 *
 * @example
 * ```typescript
 * const aiHelper = new CrawlerAIHelper();
 *
 * // タグ抽出のみ
 * const tags = await aiHelper.extractTags('素人ギャルの中出しSEX');
 *
 * // フル処理
 * const result = await aiHelper.processProduct({
 *   title: '素人ギャルの中出しSEX',
 *   description: '美人ギャルとの濃厚プレイ',
 *   performers: ['山田花子'],
 * }, {
 *   extractTags: true,
 *   translate: true,
 *   generateDescription: true,
 * });
 * ```
 */
export class CrawlerAIHelper {
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  /**
   * AI機能の有効/無効を設定
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * AI機能が有効かどうか
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * タイトル・説明からタグを抽出
   */
  async extractTags(
    title: string,
    description?: string
  ): Promise<ExtractedTags | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      return await extractProductTags(title, description);
    } catch (error) {
      console.error('[CrawlerAI] Tag extraction failed:', error);
      return null;
    }
  }

  /**
   * 商品情報を多言語翻訳
   */
  async translate(
    title: string,
    description?: string
  ): Promise<ProductTranslation | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      return await translateProduct(title, description);
    } catch (error) {
      console.error('[CrawlerAI] Translation failed:', error);
      return null;
    }
  }

  /**
   * AI説明文を生成
   */
  async generateDescription(
    input: ProductAIInput
  ): Promise<GeneratedDescription | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      return await generateProductDescription({
        title: input.title,
        ...(input.description !== undefined && { originalDescription: input.description }),
        ...(input.performers !== undefined && { performers: input.performers }),
        ...(input.genres !== undefined && { genres: input.genres }),
        ...(input.maker !== undefined && { maker: input.maker }),
        ...(input.releaseDate !== undefined && { releaseDate: input.releaseDate }),
      });
    } catch (error) {
      console.error('[CrawlerAI] Description generation failed:', error);
      return null;
    }
  }

  /**
   * 商品のAI処理をまとめて実行
   *
   * 複数のAI機能を一度に実行し、結果をまとめて返す
   */
  async processProduct(
    input: ProductAIInput,
    options: CrawlerAIOptions = {}
  ): Promise<AIProcessingResult> {
    const {
      extractTags = true,
      translate = true,
      generateDescription = false,
      throwOnError = false,
    } = options;

    const result: AIProcessingResult = {
      errors: [],
    };

    if (!this.enabled) {
      return result;
    }

    // 並列実行で効率化
    const promises: Promise<void>[] = [];

    // タグ抽出
    if (extractTags) {
      promises.push(
        this.extractTags(input.title, input.description)
          .then((tags) => {
            if (tags) {
              result.tags = tags;
            }
          })
          .catch((error) => {
            result.errors.push(`Tag extraction: ${error.message}`);
            if (throwOnError) throw error;
          })
      );
    }

    // 翻訳
    if (translate) {
      promises.push(
        this.translate(input.title, input.description)
          .then((translations) => {
            if (translations) {
              result.translations = translations;
            }
          })
          .catch((error) => {
            result.errors.push(`Translation: ${error.message}`);
            if (throwOnError) throw error;
          })
      );
    }

    // 説明文生成
    if (generateDescription) {
      promises.push(
        this.generateDescription(input)
          .then((description) => {
            if (description) {
              result['description'] = description;
            }
          })
          .catch((error) => {
            result.errors.push(`Description generation: ${error.message}`);
            if (throwOnError) throw error;
          })
      );
    }

    await Promise.all(promises);

    return result;
  }

  /**
   * 複数商品を一括処理
   *
   * レート制限を考慮して順次処理
   */
  async processProducts(
    inputs: ProductAIInput[],
    options: CrawlerAIOptions = {},
    delayMs = 500
  ): Promise<AIProcessingResult[]> {
    const results: AIProcessingResult[] = [];

    for (const input of inputs) {
      const result = await this.processProduct(input, options);
      results.push(result);

      // レート制限対策のディレイ
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let defaultInstance: CrawlerAIHelper | null = null;

/**
 * デフォルトのAIヘルパーインスタンスを取得
 */
export function getAIHelper(): CrawlerAIHelper {
  if (!defaultInstance) {
    defaultInstance = new CrawlerAIHelper();
  }
  return defaultInstance;
}

/**
 * AI機能を使って商品を処理（シンプルなヘルパー関数）
 */
export async function processProductWithAI(
  input: ProductAIInput,
  options?: CrawlerAIOptions
): Promise<AIProcessingResult> {
  return getAIHelper().processProduct(input, options);
}
