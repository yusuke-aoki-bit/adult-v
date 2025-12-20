/**
 * ソクミル (Sokmil) Affiliate API Client
 *
 * 公式ドキュメント: https://sokmil-ad.com/member/api
 * クレジット表示義務: 必須 (すべてのAPI利用サイト・アプリに表示)
 *
 * 提供API:
 * - 商品検索API (api_m_item)
 * - メーカー検索API (api_m_maker)
 * - レーベル検索API (api_m_label)
 * - シリーズ検索API (api_m_series)
 * - ジャンル検索API (api_m_genre)
 * - 監督検索API (api_m_director)
 * - 出演者検索API (api_m_actor)
 */

/**
 * ソクミル API基本パラメータ
 */
export interface SokmilBaseParams {
  /** API KEY (必須) */
  api_key: string;
}

/**
 * 商品検索APIパラメータ
 *
 * 公式ドキュメント準拠:
 * https://sokmil-ad.com/api/v1/Item
 */
export interface SokmilItemSearchParams extends SokmilBaseParams {
  /** 取得件数 (初期値：20、最大：100) */
  hits?: number;
  /** 取得開始位置 (初期値：1、最大：50000) */
  offset?: number;
  /** 並び順 (price: 価格高い順, -price: 価格安い順, date: 新着) */
  sort?: 'price' | '-price' | 'date';
  /** カテゴリ (av: アダルト動画, idol: グラビア) */
  category?: 'av' | 'idol';
  /** キーワード (商品名/ジャンル名/出演者名から検索) */
  keyword?: string;
  /** 検索項目 (actor, director, genre, maker, label, series) */
  article?: 'actor' | 'director' | 'genre' | 'maker' | 'label' | 'series';
  /** 検索ID (articleと組み合わせて使用) */
  article_id?: string;
  /** 配信開始日以降 (ISO8601形式: 2016-04-01T00:00:00) */
  gte_date?: string;
  /** 配信開始日以前 (ISO8601形式: 2016-04-01T00:00:00) */
  lte_date?: string;
}

/**
 * メーカー検索APIパラメータ
 */
export interface SokmilMakerSearchParams extends SokmilBaseParams {
  /** メーカーID */
  maker_id?: string;
  /** メーカー名 (部分一致) */
  maker_name?: string;
}

/**
 * レーベル検索APIパラメータ
 */
export interface SokmilLabelSearchParams extends SokmilBaseParams {
  /** レーベルID */
  label_id?: string;
  /** レーベル名 (部分一致) */
  label_name?: string;
  /** メーカーID */
  maker_id?: string;
}

/**
 * シリーズ検索APIパラメータ
 */
export interface SokmilSeriesSearchParams extends SokmilBaseParams {
  /** シリーズID */
  series_id?: string;
  /** シリーズ名 (部分一致) */
  series_name?: string;
}

/**
 * ジャンル検索APIパラメータ
 */
export interface SokmilGenreSearchParams extends SokmilBaseParams {
  /** ジャンルID */
  genre_id?: string;
  /** ジャンル名 (部分一致) */
  genre_name?: string;
}

/**
 * 監督検索APIパラメータ
 */
export interface SokmilDirectorSearchParams extends SokmilBaseParams {
  /** 監督ID */
  director_id?: string;
  /** 監督名 (部分一致) */
  director_name?: string;
}

/**
 * 出演者検索APIパラメータ
 */
export interface SokmilActorSearchParams extends SokmilBaseParams {
  /** 出演者ID */
  actor_id?: string;
  /** 出演者名 (部分一致) */
  actor_name?: string;
}

/**
 * ソクミル商品情報
 */
export interface SokmilProduct {
  /** 商品ID */
  itemId: string;
  /** 商品名 */
  itemName: string;
  /** 商品URL */
  itemUrl: string;
  /** アフィリエイトURL */
  affiliateUrl: string;
  /** サムネイル画像URL */
  thumbnailUrl?: string;
  /** パッケージ画像URL */
  packageImageUrl?: string;
  /** サンプル画像URLリスト */
  sampleImages?: string[];
  /** サンプル動画URL */
  sampleVideoUrl?: string;
  /** 価格 */
  price?: number;
  /** 発売日 (YYYY-MM-DD) */
  releaseDate?: string;
  /** 収録時間 (分) */
  duration?: number;
  /** メーカー */
  maker?: {
    id: string;
    name: string;
  };
  /** レーベル */
  label?: {
    id: string;
    name: string;
  };
  /** シリーズ */
  series?: {
    id: string;
    name: string;
  };
  /** ジャンルリスト */
  genres?: Array<{
    id: string;
    name: string;
  }>;
  /** 監督リスト */
  directors?: Array<{
    id: string;
    name: string;
  }>;
  /** 出演者リスト */
  actors?: Array<{
    id: string;
    name: string;
  }>;
  /** 説明文 */
  description?: string;
}

/**
 * メーカー情報
 */
export interface SokmilMaker {
  makerId: string;
  makerName: string;
  itemCount?: number;
}

/**
 * レーベル情報
 */
export interface SokmilLabel {
  labelId: string;
  labelName: string;
  makerId?: string;
  makerName?: string;
  itemCount?: number;
}

/**
 * シリーズ情報
 */
export interface SokmilSeries {
  seriesId: string;
  seriesName: string;
  itemCount?: number;
}

/**
 * ジャンル情報
 */
export interface SokmilGenre {
  genreId: string;
  genreName: string;
  itemCount?: number;
}

/**
 * 監督情報
 */
export interface SokmilDirector {
  directorId: string;
  directorName: string;
  itemCount?: number;
}

/**
 * 出演者情報
 */
export interface SokmilActor {
  actorId: string;
  actorName: string;
  itemCount?: number;
}

/**
 * API レスポンス (ジェネリック型)
 */
export interface SokmilApiResponse<T> {
  /** ステータス */
  status: 'success' | 'error';
  /** 総件数 */
  totalCount: number;
  /** 現在のページ */
  currentPage: number;
  /** 1ページあたりの件数 */
  perPage: number;
  /** データ */
  data: T[];
  /** エラーメッセージ (エラー時) */
  error?: string;
}

/**
 * ソクミル API Client
 */
export class SokmilApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly affiliateId: string;

  constructor(config: {
    apiKey: string;
    affiliateId?: string;
    baseUrl?: string;
  }) {
    this.apiKey = config.apiKey;
    this.affiliateId = config.affiliateId || '47418-001';
    // 正しいSOKMIL API エンドポイント (api.サブドメインではなくルート)
    this.baseUrl = config.baseUrl || 'https://sokmil-ad.com/api/v1';
  }

  /**
   * API リクエストを送信
   *
   * @param endpoint APIエンドポイント
   * @param params パラメータ
   * @returns レスポンス
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<SokmilApiResponse<T>> {
    const searchParams = new URLSearchParams({
      affiliate_id: this.affiliateId,
      api_key: this.apiKey,
      output: 'json',
      ...Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>),
    });

    const url = `${this.baseUrl}/${endpoint}?${searchParams.toString()}`;

    console.log(`[SOKMIL API] Requesting: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Sokmil-API-Client/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Sokmil API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[SOKMIL API] Response:', JSON.stringify(data).substring(0, 500));
      return this.normalizeResponse<T>(data);
    } catch (error) {
      throw new Error(
        `Failed to fetch from Sokmil API: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * レスポンスを正規化
   *
   * @param data 生のレスポンス
   * @returns 正規化されたレスポンス
   */
  private normalizeResponse<T>(data: any): SokmilApiResponse<T> {
    // SOKMIL APIのレスポンス構造: { result: { status, result_count, total_count, items: [...] } }
    const result = data.result || data;
    return {
      status: result.status === '200' ? 'success' : 'error',
      totalCount: parseInt(result.total_count || result.totalCount || '0', 10),
      currentPage: parseInt(result.first_position || result.currentPage || '1', 10),
      perPage: parseInt(result.result_count || result.perPage || '20', 10),
      data: result.items || result.data || [],
      error: result.error || data.message,
    };
  }

  /**
   * 商品を検索
   *
   * @param params 検索パラメータ
   * @returns 商品リスト
   */
  async searchItems(
    params: Omit<SokmilItemSearchParams, 'api_key'> = {}
  ): Promise<SokmilApiResponse<SokmilProduct>> {
    const response = await this.request<any>('Item', params);
    return {
      ...response,
      data: response.data.map((item: any) => this.normalizeProduct(item)),
    };
  }

  /**
   * 商品データを正規化
   */
  private normalizeProduct(data: any): SokmilProduct {
    // SOKMIL API v1 の実際のレスポンス構造に対応
    const itemInfo = data.iteminfo || {};
    const makers = itemInfo.maker || [];
    const labels = itemInfo.label || [];
    const genres = itemInfo.genre || [];
    const actors = itemInfo.actor || [];
    const directors = itemInfo.director || [];

    // サンプル動画URLを取得（複数のパターンを試行）
    let sampleVideoUrl: string | undefined;
    if (data.sampleMovieURL) {
      sampleVideoUrl = data.sampleMovieURL;
    } else if (data.sampleVideoURL) {
      sampleVideoUrl = data.sampleVideoURL;
    } else if (data.sample_movie_url) {
      sampleVideoUrl = data.sample_movie_url;
    }

    // サンプル画像URLを取得（複数のパターンを試行）
    // SOKMIL APIの可能なレスポンス構造:
    // - sampleImageURL: { image: string[] }
    // - sampleImageURL: string[]
    // - sample_image_url: { image: string[] }
    // - sample_image_url: string[]
    let sampleImages: string[] = [];
    if (data.sampleImageURL) {
      if (Array.isArray(data.sampleImageURL)) {
        sampleImages = data.sampleImageURL;
      } else if (data.sampleImageURL.image && Array.isArray(data.sampleImageURL.image)) {
        sampleImages = data.sampleImageURL.image;
      } else if (typeof data.sampleImageURL === 'object') {
        // オブジェクト内の配列を探す
        const values = Object.values(data.sampleImageURL);
        for (const val of values) {
          if (Array.isArray(val)) {
            sampleImages = val as string[];
            break;
          }
        }
      }
    } else if (data.sample_image_url) {
      if (Array.isArray(data.sample_image_url)) {
        sampleImages = data.sample_image_url;
      } else if (data.sample_image_url.image && Array.isArray(data.sample_image_url.image)) {
        sampleImages = data.sample_image_url.image;
      }
    }

    return {
      itemId: data.id || '',
      itemName: data.title || '',
      itemUrl: data.URL || '',
      affiliateUrl: data.affiliateURL || '',
      // 大きい画像(large)を優先して使用
      // APIレスポンス: imageURL.large > imageURL.list > imageURL.small
      thumbnailUrl: data.imageURL?.large || data.imageURL?.list || data.imageURL?.small,
      packageImageUrl: data.imageURL?.large,
      sampleImages,
      sampleVideoUrl,
      price: data.prices?.price ? parseInt(data.prices.price.replace(/[^0-9]/g, ''), 10) : undefined,
      releaseDate: data.date,
      duration: data.volume ? parseInt(data.volume.replace(/[^0-9]/g, ''), 10) : undefined,
      maker: makers[0]
        ? {
            id: makers[0].id,
            name: makers[0].name,
          }
        : undefined,
      label: labels[0]
        ? {
            id: labels[0].id,
            name: labels[0].name,
          }
        : undefined,
      series: undefined, // iteminfo にシリーズ情報がない
      genres: genres.map((g: any) => ({
        id: g.id,
        name: g.name,
      })),
      directors: directors.map((d: any) => ({
        id: d.id,
        name: d.name,
      })),
      actors: actors.map((a: any) => ({
        id: a.id,
        name: a.name,
      })),
      description: data.description || data.desc,
    };
  }

  /**
   * メーカーを検索
   *
   * @param params 検索パラメータ
   * @returns メーカーリスト
   */
  async searchMakers(
    params: Omit<SokmilMakerSearchParams, 'api_key'> = {}
  ): Promise<SokmilApiResponse<SokmilMaker>> {
    return this.request<SokmilMaker>('api_m_maker', params);
  }

  /**
   * レーベルを検索
   *
   * @param params 検索パラメータ
   * @returns レーベルリスト
   */
  async searchLabels(
    params: Omit<SokmilLabelSearchParams, 'api_key'> = {}
  ): Promise<SokmilApiResponse<SokmilLabel>> {
    return this.request<SokmilLabel>('api_m_label', params);
  }

  /**
   * シリーズを検索
   *
   * @param params 検索パラメータ
   * @returns シリーズリスト
   */
  async searchSeries(
    params: Omit<SokmilSeriesSearchParams, 'api_key'> = {}
  ): Promise<SokmilApiResponse<SokmilSeries>> {
    return this.request<SokmilSeries>('api_m_series', params);
  }

  /**
   * ジャンルを検索
   *
   * @param params 検索パラメータ
   * @returns ジャンルリスト
   */
  async searchGenres(
    params: Omit<SokmilGenreSearchParams, 'api_key'> = {}
  ): Promise<SokmilApiResponse<SokmilGenre>> {
    return this.request<SokmilGenre>('api_m_genre', params);
  }

  /**
   * 監督を検索
   *
   * @param params 検索パラメータ
   * @returns 監督リスト
   */
  async searchDirectors(
    params: Omit<SokmilDirectorSearchParams, 'api_key'> = {}
  ): Promise<SokmilApiResponse<SokmilDirector>> {
    return this.request<SokmilDirector>('api_m_director', params);
  }

  /**
   * 出演者を検索
   *
   * @param params 検索パラメータ
   * @returns 出演者リスト
   */
  async searchActors(
    params: Omit<SokmilActorSearchParams, 'api_key'> = {}
  ): Promise<SokmilApiResponse<SokmilActor>> {
    return this.request<SokmilActor>('api_m_actor', params);
  }

  /**
   * 商品IDで商品を検索（キーワード検索で代用）
   *
   * @param itemId 商品ID（品番）
   * @returns 商品情報
   */
  async getItemById(itemId: string): Promise<SokmilProduct | null> {
    // Sokmil Item APIにはitem_id検索がないため、keywordで代用
    const response = await this.searchItems({ keyword: itemId, hits: 10 });
    // 完全一致を探す
    const match = response.data.find(item => item.itemId === itemId);
    return match || (response.data.length > 0 ? response.data[0] : null);
  }

  /**
   * キーワードで商品を検索
   *
   * @param keyword キーワード
   * @param hits 取得件数 (最大100)
   * @param offset 取得開始位置 (1から開始)
   * @returns 商品リスト
   */
  async searchByKeyword(
    keyword: string,
    hits: number = 20,
    offset: number = 1
  ): Promise<SokmilApiResponse<SokmilProduct>> {
    return this.searchItems({
      keyword,
      hits,
      offset,
    });
  }

  /**
   * 出演者IDで商品を検索
   *
   * @param actorId 出演者ID
   * @param hits 取得件数 (最大100)
   * @param offset 取得開始位置 (1から開始)
   * @returns 商品リスト
   */
  async searchByActor(
    actorId: string,
    hits: number = 20,
    offset: number = 1
  ): Promise<SokmilApiResponse<SokmilProduct>> {
    return this.searchItems({
      article: 'actor',
      article_id: actorId,
      hits,
      offset,
    });
  }

  /**
   * 新着商品を取得
   *
   * @param hits 取得件数 (最大100)
   * @param offset 取得開始位置 (1から開始)
   * @returns 商品リスト
   */
  async getNewReleases(
    hits: number = 20,
    offset: number = 1
  ): Promise<SokmilApiResponse<SokmilProduct>> {
    return this.searchItems({
      sort: 'date',
      hits,
      offset,
    });
  }

  /**
   * 全商品をページング取得（クローラー用）
   *
   * @param options オプション
   * @returns 商品リストのジェネレーター
   */
  async *fetchAllItems(options: {
    category?: 'av' | 'idol';
    gte_date?: string;
    lte_date?: string;
    hits?: number;
  } = {}): AsyncGenerator<SokmilProduct[], void, unknown> {
    const hits = options.hits || 100; // 最大100件
    let offset = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.searchItems({
        category: options.category,
        gte_date: options.gte_date,
        lte_date: options.lte_date,
        sort: 'date',
        hits,
        offset,
      });

      if (response.data.length === 0) {
        hasMore = false;
        break;
      }

      yield response.data;

      // offset最大50000の制限
      if (offset + hits > 50000) {
        console.log('[SOKMIL] Reached offset limit (50000)');
        hasMore = false;
        break;
      }

      offset += hits;

      // 総件数を超えた場合
      if (offset > response.totalCount) {
        hasMore = false;
      }

      // API負荷軽減のため少し待機
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

/**
 * ソクミルクライアントのシングルトンインスタンスを取得
 */
export function getSokmilClient(): SokmilApiClient {
  const apiKey = process.env.SOKMIL_API_KEY;

  if (!apiKey) {
    throw new Error('SOKMIL_API_KEY must be set in environment variables');
  }

  return new SokmilApiClient({ apiKey });
}
