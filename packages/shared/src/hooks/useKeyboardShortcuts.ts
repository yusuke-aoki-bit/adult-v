'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  /** キーの組み合わせ (例: 'ctrl+k', 'cmd+k', 'escape') */
  key: string;
  /** ショートカット発火時のコールバック */
  handler: (event: KeyboardEvent) => void;
  /** 入力欄でも発火するか（デフォルト: false） */
  enableInInput?: boolean;
  /** 説明（ヘルプ表示用） */
  description?: string;
}

interface UseKeyboardShortcutsOptions {
  /** ショートカットを有効にするか */
  enabled?: boolean;
}

/**
 * キーボードショートカットを登録するhook
 *
 * @example
 * useKeyboardShortcuts([
 *   {
 *     key: 'ctrl+k',
 *     handler: () => focusSearch(),
 *     description: '検索にフォーカス',
 *   },
 *   {
 *     key: 'escape',
 *     handler: () => closeModal(),
 *     enableInInput: true,
 *   },
 * ]);
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // 入力欄かどうかを判定
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        // 入力欄で無効なショートカットをスキップ
        if (isInputElement && !shortcut.enableInInput) {
          continue;
        }

        if (matchesShortcut(event, shortcut.key)) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.handler(event);
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * イベントがショートカットキーにマッチするか判定
 */
function matchesShortcut(event: KeyboardEvent, shortcutKey: string): boolean {
  const parts = shortcutKey.toLowerCase().split('+');
  const key = parts.pop() || '';

  const requiresCtrl = parts.includes('ctrl') || parts.includes('control');
  const requiresMeta = parts.includes('cmd') || parts.includes('meta') || parts.includes('command');
  const requiresAlt = parts.includes('alt') || parts.includes('option');
  const requiresShift = parts.includes('shift');

  // Ctrl/Cmd の両方に対応（macOS と Windows）
  const hasModifier = requiresCtrl || requiresMeta;
  const modifierMatch = hasModifier
    ? event.ctrlKey || event.metaKey
    : !event.ctrlKey && !event.metaKey;

  // 個別の修飾キーチェック
  const altMatch = requiresAlt ? event.altKey : !event.altKey;
  const shiftMatch = requiresShift ? event.shiftKey : !event.shiftKey;

  // キーのマッチング
  const eventKey = event.key.toLowerCase();
  const keyMatch =
    eventKey === key ||
    event.code.toLowerCase() === key ||
    event.code.toLowerCase() === `key${key}`;

  return modifierMatch && altMatch && shiftMatch && keyMatch;
}

/**
 * 検索フォーカス用のグローバルショートカットを設定するhook
 *
 * @example
 * useSearchShortcut(() => {
 *   searchInputRef.current?.focus();
 * });
 */
export function useSearchShortcut(onFocus: () => void): void {
  useKeyboardShortcuts([
    {
      key: 'ctrl+k',
      handler: onFocus,
      description: '検索にフォーカス',
    },
  ]);
}
