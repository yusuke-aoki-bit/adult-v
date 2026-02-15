/**
 * ASP名から表示用ラベルへのマッピング
 * 両サイト（adult-v, fanza）で共通使用
 *
 * 定数はレジストリから自動導出。
 */

export { PROVIDER_LABEL_MAP } from '../asp-registry';
import { PROVIDER_LABEL_MAP } from '../asp-registry';

/**
 * ASP名から表示用ラベルを取得
 * @param aspName - ASP名
 * @returns 表示用ラベル（見つからない場合は元のASP名を返す）
 */
export function getProviderLabel(aspName: string): string {
  const upperName = aspName.toUpperCase();
  return PROVIDER_LABEL_MAP[upperName] || PROVIDER_LABEL_MAP[aspName] || aspName;
}
