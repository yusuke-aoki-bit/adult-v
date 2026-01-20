'use client';

import { useState, useCallback, useMemo } from 'react';
import { Upload, ClipboardPaste, AlertTriangle, CheckCircle2, FileText, X } from 'lucide-react';

const translations = {
  ja: {
    title: '購入履歴インポート',
    description: 'DMM/FANZAの購入履歴をインポートして予算管理に反映できます',
    pasteArea: 'DMM/FANZAの購入履歴をここに貼り付け',
    pasteHint: 'マイページ > 購入履歴からテキストをコピーして貼り付けてください',
    parseButton: '解析する',
    importButton: 'インポート',
    cancel: 'キャンセル',
    parsed: '解析結果',
    noResults: '購入履歴が見つかりませんでした',
    importSuccess: '件の購入履歴をインポートしました',
    importError: 'インポートに失敗しました',
    selectAll: 'すべて選択',
    deselectAll: '選択解除',
    selected: '件選択中',
    totalAmount: '合計金額',
    howToImport: 'インポート方法',
    step1: '1. DMM/FANZAにログイン',
    step2: '2. マイページ > 購入履歴を開く',
    step3: '3. 履歴テキストをCtrl+Aで全選択してコピー',
    step4: '4. このエリアに貼り付け',
  },
  en: {
    title: 'Import Purchase History',
    description: 'Import your DMM/FANZA purchase history to track your budget',
    pasteArea: 'Paste your DMM/FANZA purchase history here',
    pasteHint: 'Copy text from My Page > Purchase History and paste here',
    parseButton: 'Parse',
    importButton: 'Import',
    cancel: 'Cancel',
    parsed: 'Parse Results',
    noResults: 'No purchase history found',
    importSuccess: 'purchase(s) imported',
    importError: 'Import failed',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
    selected: 'selected',
    totalAmount: 'Total',
    howToImport: 'How to Import',
    step1: '1. Log in to DMM/FANZA',
    step2: '2. Go to My Page > Purchase History',
    step3: '3. Select all (Ctrl+A) and copy the text',
    step4: '4. Paste here',
  },
  zh: {
    title: '导入购买历史',
    description: '从DMM/FANZA导入购买历史以追踪预算',
    pasteArea: '在此粘贴DMM/FANZA购买历史',
    pasteHint: '从我的页面>购买历史复制文本并粘贴到此处',
    parseButton: '解析',
    importButton: '导入',
    cancel: '取消',
    parsed: '解析结果',
    noResults: '未找到购买历史',
    importSuccess: '条购买记录已导入',
    importError: '导入失败',
    selectAll: '全选',
    deselectAll: '取消选择',
    selected: '已选择',
    totalAmount: '总金额',
    howToImport: '导入方法',
    step1: '1. 登录DMM/FANZA',
    step2: '2. 打开我的页面>购买历史',
    step3: '3. 用Ctrl+A全选并复制文本',
    step4: '4. 粘贴到此处',
  },
  ko: {
    title: '구매 내역 가져오기',
    description: 'DMM/FANZA 구매 내역을 가져와 예산을 관리하세요',
    pasteArea: 'DMM/FANZA 구매 내역을 여기에 붙여넣기',
    pasteHint: '마이 페이지 > 구매 내역에서 텍스트를 복사하여 붙여넣으세요',
    parseButton: '분석',
    importButton: '가져오기',
    cancel: '취소',
    parsed: '분석 결과',
    noResults: '구매 내역을 찾을 수 없습니다',
    importSuccess: '개의 구매 내역을 가져왔습니다',
    importError: '가져오기 실패',
    selectAll: '전체 선택',
    deselectAll: '선택 해제',
    selected: '개 선택됨',
    totalAmount: '총 금액',
    howToImport: '가져오기 방법',
    step1: '1. DMM/FANZA 로그인',
    step2: '2. 마이 페이지 > 구매 내역 열기',
    step3: '3. Ctrl+A로 전체 선택 후 복사',
    step4: '4. 여기에 붙여넣기',
  },
} as const;

interface ParsedPurchase {
  id: string;
  title: string;
  price: number;
  date: string;
  productCode?: string | undefined;
  selected: boolean;
}

// 入力バリデーション定数
const MAX_INPUT_LENGTH = 500000; // 500KB制限
const MAX_TITLE_LENGTH = 200;
const MIN_TITLE_LENGTH = 5;
const MAX_PRICE = 99999;
const MIN_PRICE = 1;

/**
 * テキスト入力のサニタイズ
 * - 制御文字を除去
 * - 過度なスペースを正規化
 */
function sanitizeInput(text: string): string {
  // 制御文字（改行・タブ以外）を除去
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // 連続する空白を単一スペースに正規化
  sanitized = sanitized.replace(/[ \t]+/g, ' ');
  // 連続する改行を2つまでに制限
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  return sanitized;
}

/**
 * 日付文字列のバリデーション
 */
function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  // 未来の日付は不正
  if (date > new Date()) return false;
  // 2000年より前の日付は不正（DMM/FANZAの開始日考慮）
  if (date < new Date('2000-01-01')) return false;
  return true;
}

interface PurchaseHistoryImporterProps {
  locale: string;
  theme?: 'light' | 'dark';
  onImport: (purchases: { productId: string; title: string; price: number; date: string }[]) => void;
  onClose?: () => void;
}

/**
 * 購入履歴テキストを解析してParsedPurchase配列を返す
 * 入力バリデーション付き
 */
function parsePurchaseHistory(text: string): ParsedPurchase[] {
  // 入力長チェック
  if (text.length > MAX_INPUT_LENGTH) {
    console.warn('[PurchaseHistoryImporter] Input too long, truncating');
    text = text.substring(0, MAX_INPUT_LENGTH);
  }

  // サニタイズ
  const sanitizedText = sanitizeInput(text);
  const purchases: ParsedPurchase[] = [];

  const lines = sanitizedText.split('\n');
  let lastDate = new Date().toISOString().split('T')[0];

  for (const line of lines) {
    // 空行スキップ
    if (!line.trim()) continue;

    // 日付を検出
    const dateMatch = line.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      if (year && month && day) {
        const candidateDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        // 日付バリデーション
        if (isValidDate(candidateDate)) {
          lastDate = candidateDate;
        }
      }
    }

    // 価格を検出
    const priceMatch = line.match(/(?:¥|￥)\s*([\d,]+)|(?:^|\s)([\d,]+)(?:円|$)/);
    if (priceMatch) {
      const priceStr = priceMatch[1] || priceMatch[2];
      if (!priceStr) continue;
      const price = parseInt(priceStr.replace(/,/g, ''), 10);

      // 価格バリデーション
      if (price >= MIN_PRICE && price <= MAX_PRICE) {
        // タイトルを抽出（価格の前の部分）
        const beforePrice = line.substring(0, line.indexOf(priceMatch[0]));
        let title = beforePrice.trim();

        // 品番を抽出（英字2-5文字 + ハイフン(任意) + 数字3-6桁のパターン）
        const codeMatch = title.match(/^([a-zA-Z]{2,5}-?\d{3,6})\s*/);
        let productCode: string | undefined;
        if (codeMatch && codeMatch[0] && codeMatch[1]) {
          productCode = codeMatch[1].toUpperCase().replace(/-/g, '');
          title = title.substring(codeMatch[0].length).trim();
        }

        // タイトルのクリーンアップ
        title = title.replace(/^[\s\-・]+/, '').replace(/[\s\-・]+$/, '').trim();
        // HTMLタグを除去（XSS対策）
        title = title.replace(/<[^>]*>/g, '');
        // 長すぎるタイトルを切り詰め
        if (title.length > MAX_TITLE_LENGTH) {
          title = title.substring(0, MAX_TITLE_LENGTH);
        }

        if (title.length >= MIN_TITLE_LENGTH && lastDate && isValidDate(lastDate)) {
          purchases.push({
            id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title,
            price,
            date: lastDate,
            ...(productCode !== undefined && { productCode }),
            selected: true,
          });
        }
      }
    }
  }

  // 重複除去（最大1000件まで）
  const seen = new Set<string>();
  const uniquePurchases = purchases.filter((p) => {
    const key = `${p.title}-${p.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniquePurchases.slice(0, 1000);
}

export default function PurchaseHistoryImporter({
  locale,
  theme = 'dark',
  onImport,
  onClose,
}: PurchaseHistoryImporterProps) {
  const t = translations[locale as keyof typeof translations] || translations.ja;
  const [inputText, setInputText] = useState('');
  const [parsedPurchases, setParsedPurchases] = useState<ParsedPurchase[]>([]);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleParse = useCallback(() => {
    const parsed = parsePurchaseHistory(inputText);
    setParsedPurchases(parsed);
    setStep('review');
  }, [inputText]);

  const handleToggleSelect = useCallback((id: string) => {
    setParsedPurchases((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }, []);

  const handleSelectAll = useCallback((select: boolean) => {
    setParsedPurchases((prev) => prev.map((p) => ({ ...p, selected: select })));
  }, []);

  const handleImport = useCallback(() => {
    const selectedPurchases = parsedPurchases
      .filter((p) => p.selected)
      .map((p) => ({
        productId: p.productCode || `imported-${p.id}`,
        title: p.title,
        price: p.price,
        date: p.date,
      }));

    if (selectedPurchases.length > 0) {
      onImport(selectedPurchases);
      setImportStatus('success');
      setTimeout(() => {
        onClose?.();
      }, 1500);
    }
  }, [parsedPurchases, onImport, onClose]);

  const handleBack = useCallback(() => {
    setStep('input');
    setParsedPurchases([]);
  }, []);

  const selectedCount = parsedPurchases.filter((p) => p.selected).length;
  const totalSelected = parsedPurchases
    .filter((p) => p.selected)
    .reduce((sum, p) => sum + p.price, 0);

  const formatPrice = useCallback((price: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(price);
  }, []);

  const bgColor = theme === 'dark' ? 'bg-gray-800' : 'bg-white';
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textMuted = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const inputBg = theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300';
  const itemBg = theme === 'dark' ? 'bg-gray-750' : 'bg-gray-100';

  return (
    <div className={`rounded-lg p-6 ${bgColor} max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-400" />
          <h3 className={`text-lg font-bold ${textColor}`}>{t.title}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-1 rounded hover:bg-gray-700 transition-colors ${textMuted}`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <p className={`text-sm ${textMuted} mb-4`}>{t.description}</p>

      {/* Success message */}
      {importStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-900/30 rounded-lg text-green-400 mb-4">
          <CheckCircle2 className="w-5 h-5" />
          <span>
            {selectedCount} {t.importSuccess}
          </span>
        </div>
      )}

      {step === 'input' ? (
        <>
          {/* Instructions */}
          <div className={`${itemBg} rounded-lg p-4 mb-4`}>
            <h4 className={`text-sm font-medium ${textColor} mb-2 flex items-center gap-2`}>
              <FileText className="w-4 h-4" />
              {t.howToImport}
            </h4>
            <ul className={`text-sm ${textMuted} space-y-1`}>
              <li>{t.step1}</li>
              <li>{t.step2}</li>
              <li>{t.step3}</li>
              <li>{t.step4}</li>
            </ul>
          </div>

          {/* Paste Area */}
          <div className="relative mb-4">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t.pasteArea}
              className={`w-full h-48 p-4 rounded-lg border ${inputBg} ${textColor} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
            />
            <ClipboardPaste className={`absolute top-4 right-4 w-5 h-5 ${textMuted}`} />
          </div>
          <p className={`text-xs ${textMuted} mb-4`}>{t.pasteHint}</p>

          {/* Parse Button */}
          <button
            onClick={handleParse}
            disabled={!inputText.trim()}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              inputText.trim()
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {t.parseButton}
          </button>
        </>
      ) : (
        <>
          {/* Review Step */}
          <div className="flex items-center justify-between mb-4">
            <h4 className={`text-sm font-medium ${textColor}`}>
              {t.parsed} ({parsedPurchases.length})
            </h4>
            <div className="flex gap-2">
              <button
                onClick={() => handleSelectAll(true)}
                className={`text-xs px-2 py-1 rounded ${textMuted} hover:text-white`}
              >
                {t.selectAll}
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className={`text-xs px-2 py-1 rounded ${textMuted} hover:text-white`}
              >
                {t.deselectAll}
              </button>
            </div>
          </div>

          {parsedPurchases.length === 0 ? (
            <div className={`${itemBg} rounded-lg p-8 text-center`}>
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-yellow-400" />
              <p className={textMuted}>{t.noResults}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {parsedPurchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    onClick={() => handleToggleSelect(purchase.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      purchase.selected
                        ? theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-700'
                          : 'bg-blue-100 border border-blue-300'
                        : itemBg
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={purchase.selected}
                      onChange={() => handleToggleSelect(purchase.id)}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${textColor} truncate`}>{purchase.title}</p>
                      <p className={`text-xs ${textMuted}`}>
                        {purchase.date}
                        {purchase.productCode && ` · ${purchase.productCode}`}
                      </p>
                    </div>
                    <span className={`text-sm font-medium ${textColor}`}>
                      {formatPrice(purchase.price)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className={`${itemBg} rounded-lg p-3 mb-4 flex items-center justify-between`}>
                <span className={textMuted}>
                  {selectedCount} {t.selected}
                </span>
                <span className={`font-medium ${textColor}`}>
                  {t.totalAmount}: {formatPrice(totalSelected)}
                </span>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {t.cancel}
            </button>
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                selectedCount > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {t.importButton} ({selectedCount})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
