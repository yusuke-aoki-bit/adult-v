'use client';

import { useState, useCallback } from 'react';

export interface CopyButtonProps {
  /** コピーするテキスト */
  text: string;
  /** ラベル（表示用） */
  label?: string;
  /** サイズ */
  size?: 'xs' | 'sm' | 'md';
  /** アイコンのみ表示 */
  iconOnly?: boolean;
  /** カスタムクラス名 */
  className?: string;
  /** コピー成功時のコールバック */
  onCopy?: () => void;
}

/**
 * クリップボードコピーボタン
 * タイトル、品番、女優名などを他サイトで検索しやすくするためのコピー機能
 */
export function CopyButton({ text, label, size = 'sm', iconOnly = false, className = '', onCopy }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [text, onCopy]);

  const sizeClasses = {
    xs: 'p-1 text-[10px]',
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded transition-all ${
        copied ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
      } ${sizeClasses[size]} ${className}`}
      title={`${label || text} をクリップボードにコピー`}
      aria-label={`${label || text} をクリップボードにコピー`}
    >
      {copied ? (
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
      {!iconOnly && (
        <span className="max-w-[120px] truncate">{copied ? 'クリップボードにコピー済み' : label || text}</span>
      )}
    </button>
  );
}

export default CopyButton;
