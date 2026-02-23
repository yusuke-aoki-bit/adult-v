'use client';

/**
 * 軽量A/Bテストフレームワーク
 * GA4と連携してバリアント別のCTRを計測
 */

export type ExperimentVariant = string;

interface Experiment {
  name: string;
  variants: ExperimentVariant[];
  weights?: number[]; // 各バリアントの重み（デフォルト均等）
}

// ストレージキープレフィックス（サイト別に設定可能）
let storageKeyPrefix: string = 'ab_test_';

/**
 * ストレージキープレフィックスを設定
 */
export function setStorageKeyPrefix(prefix: string) {
  storageKeyPrefix = prefix;
}

/**
 * 実験定義
 */
export const experiments: Record<string, Experiment> = {
  ctaButtonText: {
    name: 'CTA Button Text',
    variants: ['control', 'urgency', 'action'],
    // control: "購入する", urgency: "今すぐ購入", action: "今すぐゲット"
  },
  priceDisplayStyle: {
    name: 'Price Display Style',
    variants: ['control', 'emphasized'],
    // control: 通常表示, emphasized: 大きめ太字
  },
  saleCountdownStyle: {
    name: 'Sale Countdown Style',
    variants: ['control', 'animated'],
    // control: 静的表示, animated: パルスアニメーション
  },
  // Phase 4: コンバージョン改善用実験
  ctaPlacement: {
    name: 'CTA Placement',
    variants: ['default', 'above_fold', 'sticky'],
    // default: フッター, above_fold: 画像下, sticky: 追従
  },
  trustBadge: {
    name: 'Trust Badge Display',
    variants: ['control', 'prominent'],
    // control: バッジなし, prominent: 公式ロゴ・安全決済バッジ表示
  },
  urgencyLevel: {
    name: 'Urgency Messaging Level',
    variants: ['subtle', 'moderate', 'prominent'],
    // subtle: 控えめ, moderate: 中程度, prominent: 強調
  },
  // FANZA導線強化用実験
  fanzaBannerStyle: {
    name: 'FANZA Banner Style',
    variants: ['footer', 'card', 'prominent'],
    // footer: フッターのみ, card: カード形式追加, prominent: 目立つバナー
  },
  fanzaSectionPosition: {
    name: 'FANZA Section Position',
    variants: ['after_weekly', 'before_actresses', 'sidebar'],
    // after_weekly: 今週の注目の後, before_actresses: 女優リストの前, sidebar: サイドバー
  },
};

/**
 * ユーザーのバリアントを取得（localStorage永続化）
 */
export function getVariant(experimentId: string): ExperimentVariant {
  if (typeof window === 'undefined') {
    return experiments[experimentId]?.variants[0] || 'control';
  }

  const experiment = experiments[experimentId];
  if (!experiment) {
    console.warn(`Unknown experiment: ${experimentId}`);
    return 'control';
  }

  const storageKey = `${storageKeyPrefix}${experimentId}`;

  // 既存のバリアントを取得
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && experiment.variants.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }

  // 新規割り当て
  const variant = assignVariant(experiment);

  // 永続化
  try {
    localStorage.setItem(storageKey, variant);
  } catch {
    // localStorage unavailable
  }

  return variant;
}

/**
 * バリアントをランダム割り当て
 */
function assignVariant(experiment: Experiment): ExperimentVariant {
  const { variants, weights } = experiment;

  if (weights && weights.length === variants.length) {
    // 重み付きランダム選択
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const random = Math.random() * totalWeight;

    let cumulative = 0;
    for (let i = 0; i < variants.length; i++) {
      const weight = weights[i];
      const variant = variants[i];
      if (weight !== undefined && variant !== undefined) {
        cumulative += weight;
        if (random < cumulative) {
          return variant;
        }
      }
    }
  }

  // 均等選択
  const randomIndex = Math.floor(Math.random() * variants.length);
  return variants[randomIndex] ?? 'control';
}

/**
 * GA4にイベントを送信
 */
export function trackExperimentEvent(
  eventName: string,
  experimentId: string,
  additionalParams?: Record<string, string | number | boolean>,
) {
  const variant = getVariant(experimentId);

  // GA4 gtag
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as { gtag: (...args: unknown[]) => void }).gtag('event', eventName, {
      experiment_id: experimentId,
      experiment_variant: variant,
      ...additionalParams,
    });
  }
}

/**
 * CTAクリックをトラック
 */
export function trackCtaClick(
  experimentId: string,
  productId: string | number,
  additionalParams?: Record<string, string | number | boolean>,
) {
  trackExperimentEvent('cta_click', experimentId, {
    product_id: String(productId),
    ...additionalParams,
  });
}

/**
 * インプレッションをトラック
 */
export function trackImpression(experimentId: string, productId?: string | number) {
  const params: Record<string, string | number | boolean> = {};
  if (productId) {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    params['product_id'] = String(productId);
  }
  trackExperimentEvent('experiment_impression', experimentId, params);
}

/**
 * すべての実験のバリアントをリセット（デバッグ用）
 */
export function resetAllExperiments() {
  if (typeof window === 'undefined') return;

  Object.keys(experiments).forEach((experimentId) => {
    try {
      localStorage.removeItem(`${storageKeyPrefix}${experimentId}`);
    } catch {
      // Ignore
    }
  });
}

/**
 * 特定の実験のバリアントを強制設定（デバッグ用）
 */
export function forceVariant(experimentId: string, variant: ExperimentVariant) {
  if (typeof window === 'undefined') return;

  const experiment = experiments[experimentId];
  if (!experiment || !experiment.variants.includes(variant)) {
    console.warn(`Invalid experiment or variant: ${experimentId}/${variant}`);
    return;
  }

  try {
    localStorage.setItem(`${storageKeyPrefix}${experimentId}`, variant);
  } catch {
    // Ignore
  }
}

/**
 * 現在のユーザーの全バリアント情報を取得
 */
export function getAllVariants(): Record<string, ExperimentVariant> {
  const result: Record<string, ExperimentVariant> = {};

  Object.keys(experiments).forEach((experimentId) => {
    result[experimentId] = getVariant(experimentId);
  });

  return result;
}
