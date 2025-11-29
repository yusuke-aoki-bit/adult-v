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
  /** ページ番号 */
  page?: number;
  /** 1ページあたりの取得件数 */
  per_page?: number;
}

/**
 * 商品検索APIパラメータ
 */
export interface SokmilItemSearchParams extends SokmilBaseParams {
  /** 商品ID */
  item_id?: string;
  /** 商品名 (部分一致) */
  item_name?: string;
  /** メーカーID */
  maker_id?: string;
  /** レーベルID */
  label_id?: string;
  /** シリーズID */
  series_id?: string;
  /** ジャンルID */
  genre_id?: string;
  /** 監督ID */
  director_id?: string;
  /** 出演者ID */
  actor_id?: string;
  /** 発売日開始 (YYYY-MM-DD) */
  release_date_from?: string;
  /** 発売日終了 (YYYY-MM-DD) */
  release_date_to?: string;
  /** ソート順 (release_date_desc, release_date_asc, price_desc, price_asc) */
  sort?: 'release_date_desc' | 'release_date_asc' | 'price_desc' | 'price_asc';
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

    return {
      itemId: data.id || '',
      itemName: data.title || '',
      itemUrl: data.URL || '',
      affiliateUrl: data.affiliateURL || '',
      thumbnailUrl: data.imageURL?.list || data.imageURL?.small,
      packageImageUrl: data.imageURL?.large,
      sampleImages: data.sampleImageURL?.image || [],
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
   * 商品IDで商品を取得
   *
   * @param itemId 商品ID
   * @returns 商品情報
   */
  async getItemById(itemId: string): Promise<SokmilProduct | null> {
    const response = await this.searchItems({ item_id: itemId });
    return response.data.length > 0 ? response.data[0] : null;
  }

  /**
   * 商品名で商品を検索
   *
   * @param itemName 商品名
   * @param page ページ番号
   * @param perPage 1ページあたりの件数
   * @returns 商品リスト
   */
  async searchByItemName(
    itemName: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<SokmilApiResponse<SokmilProduct>> {
    return this.searchItems({
      item_name: itemName,
      page,
      per_page: perPage,
    });
  }

  /**
   * 出演者IDで商品を検索
   *
   * @param actorId 出演者ID
   * @param page ページ番号
   * @param perPage 1ページあたりの件数
   * @returns 商品リスト
   */
  async searchByActor(
    actorId: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<SokmilApiResponse<SokmilProduct>> {
    return this.searchItems({
      actor_id: actorId,
      page,
      per_page: perPage,
    });
  }

  /**
   * 新着商品を取得
   *
   * @param page ページ番号
   * @param perPage 1ページあたりの件数
   * @returns 商品リスト
   */
  async getNewReleases(
    page: number = 1,
    perPage: number = 20
  ): Promise<SokmilApiResponse<SokmilProduct>> {
    // SOKMIL APIは最小限のパラメータのみ使用（sort, offset, hitsは500エラーの原因）
    return this.searchItems({});
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
