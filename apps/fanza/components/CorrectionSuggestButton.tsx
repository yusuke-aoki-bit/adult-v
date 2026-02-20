'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { CorrectionForm, CorrectionList, type CorrectionFormTranslations, type CorrectionListTranslations } from '@adult-v/shared/components';
import { useCorrections } from '@adult-v/shared/hooks';
import { useFirebaseAuth } from '@adult-v/shared/contexts';

const translations: Record<string, {
  buttonLabel: string;
  form: CorrectionFormTranslations;
  list: CorrectionListTranslations;
  fieldLabels: Record<string, string>;
}> = {
  ja: {
    buttonLabel: '情報の修正を提案',
    form: {
      title: '情報修正の提案',
      fieldLabel: '修正するフィールド',
      currentValue: '現在の値',
      suggestedValue: '正しい値',
      suggestedValuePlaceholder: '正しい情報を入力してください',
      reason: '修正理由（任意）',
      reasonPlaceholder: 'なぜこの修正が必要か教えてください',
      submit: '提案を送信',
      submitting: '送信中...',
      cancel: 'キャンセル',
      success: '修正提案が送信されました！',
      error: '送信に失敗しました',
      loginRequired: 'ログインが必要です',
      fieldRequired: 'フィールドを選択してください',
      valueRequired: '正しい値を入力してください',
    },
    list: {
      title: 'これまでの修正提案',
      empty: 'まだ修正提案はありません',
      pending: '審査中',
      approved: '承認済み',
      rejected: '却下',
      field: 'フィールド',
      currentValue: '現在の値',
      suggestedValue: '提案値',
      reason: '理由',
      submittedAt: '提出日時',
      reviewedAt: '審査日時',
      delete: '削除',
      deleteConfirm: 'この修正提案を削除しますか？',
      showMore: 'さらに表示',
      showLess: '閉じる',
    },
    fieldLabels: {
      title: 'タイトル',
      releaseDate: '発売日',
      duration: '再生時間',
      description: '説明',
      makerProductCode: '品番',
    },
  },
  en: {
    buttonLabel: 'Suggest Correction',
    form: {
      title: 'Suggest a Correction',
      fieldLabel: 'Field to correct',
      currentValue: 'Current value',
      suggestedValue: 'Correct value',
      suggestedValuePlaceholder: 'Enter the correct information',
      reason: 'Reason (optional)',
      reasonPlaceholder: 'Explain why this correction is needed',
      submit: 'Submit',
      submitting: 'Submitting...',
      cancel: 'Cancel',
      success: 'Correction submitted!',
      error: 'Failed to submit',
      loginRequired: 'Login required',
      fieldRequired: 'Please select a field',
      valueRequired: 'Please enter the correct value',
    },
    list: {
      title: 'Previous Corrections',
      empty: 'No corrections yet',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      field: 'Field',
      currentValue: 'Current',
      suggestedValue: 'Suggested',
      reason: 'Reason',
      submittedAt: 'Submitted',
      reviewedAt: 'Reviewed',
      delete: 'Delete',
      deleteConfirm: 'Delete this correction?',
      showMore: 'Show more',
      showLess: 'Show less',
    },
    fieldLabels: {
      title: 'Title',
      releaseDate: 'Release Date',
      duration: 'Duration',
      description: 'Description',
      makerProductCode: 'Product Code',
    },
  },
  zh: {
    buttonLabel: '建议修正',
    form: {
      title: '建议修正',
      fieldLabel: '修正字段',
      currentValue: '当前值',
      suggestedValue: '正确值',
      suggestedValuePlaceholder: '输入正确的信息',
      reason: '修正原因（选填）',
      reasonPlaceholder: '说明为什么需要这个修正',
      submit: '提交',
      submitting: '提交中...',
      cancel: '取消',
      success: '修正建议已提交！',
      error: '提交失败',
      loginRequired: '需要登录',
      fieldRequired: '请选择字段',
      valueRequired: '请输入正确的值',
    },
    list: {
      title: '修正历史',
      empty: '暂无修正建议',
      pending: '审核中',
      approved: '已批准',
      rejected: '已拒绝',
      field: '字段',
      currentValue: '当前',
      suggestedValue: '建议',
      reason: '原因',
      submittedAt: '提交时间',
      reviewedAt: '审核时间',
      delete: '删除',
      deleteConfirm: '删除此修正建议？',
      showMore: '显示更多',
      showLess: '收起',
    },
    fieldLabels: {
      title: '标题',
      releaseDate: '发售日',
      duration: '时长',
      description: '描述',
      makerProductCode: '品番',
    },
  },
  ko: {
    buttonLabel: '정보 수정 제안',
    form: {
      title: '정보 수정 제안',
      fieldLabel: '수정할 필드',
      currentValue: '현재 값',
      suggestedValue: '올바른 값',
      suggestedValuePlaceholder: '올바른 정보를 입력하세요',
      reason: '수정 이유 (선택)',
      reasonPlaceholder: '이 수정이 필요한 이유를 설명해주세요',
      submit: '제출',
      submitting: '제출 중...',
      cancel: '취소',
      success: '수정 제안이 제출되었습니다!',
      error: '제출 실패',
      loginRequired: '로그인이 필요합니다',
      fieldRequired: '필드를 선택하세요',
      valueRequired: '올바른 값을 입력하세요',
    },
    list: {
      title: '수정 내역',
      empty: '수정 제안이 없습니다',
      pending: '검토 중',
      approved: '승인됨',
      rejected: '거부됨',
      field: '필드',
      currentValue: '현재',
      suggestedValue: '제안',
      reason: '이유',
      submittedAt: '제출 일시',
      reviewedAt: '검토 일시',
      delete: '삭제',
      deleteConfirm: '이 수정 제안을 삭제하시겠습니까?',
      showMore: '더 보기',
      showLess: '접기',
    },
    fieldLabels: {
      title: '제목',
      releaseDate: '출시일',
      duration: '재생 시간',
      description: '설명',
      makerProductCode: '품번',
    },
  },
};

interface CorrectionSuggestButtonProps {
  targetType: 'product' | 'performer';
  targetId: number;
  locale: string;
  fields: Array<{
    name: string;
    currentValue: string | null;
  }>;
}

export default function CorrectionSuggestButton({
  targetType,
  targetId,
  locale,
  fields,
}: CorrectionSuggestButtonProps) {
  const t = translations[locale] || translations.ja;
  const { user, linkGoogle } = useFirebaseAuth();
  const userId = user?.uid ?? null;

  const [showForm, setShowForm] = useState(false);
  const {
    corrections,
    isLoading: _isLoading,
    fetchCorrections,
    submitCorrection,
    deleteCorrection,
  } = useCorrections({ targetType, targetId, userId });

  useEffect(() => {
    if (showForm) {
      fetchCorrections();
    }
  }, [showForm, fetchCorrections]);

  const handleSubmit = async (data: {
    fieldName: string;
    currentValue: string | null;
    suggestedValue: string;
    reason: string | null;
  }) => {
    await submitCorrection(data);
  };

  const fieldsWithLabels = fields.map((f) => ({
    ...f,
    label: t.fieldLabels[f.name] || f.name,
  }));

  if (!showForm) {
    return (
      <button
        onClick={() => {
          if (!userId) {
            linkGoogle();
            return;
          }
          setShowForm(true);
        }}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-yellow-400 transition-colors"
      >
        <AlertCircle className="h-4 w-4" />
        {t.buttonLabel}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <CorrectionForm
        targetType={targetType}
        targetId={targetId}
        userId={userId}
        fields={fieldsWithLabels}
        onSubmit={handleSubmit}
        onClose={() => setShowForm(false)}
        translations={t.form}
      />

      {corrections.length > 0 && (
        <CorrectionList
          corrections={corrections}
          currentUserId={userId}
          fieldLabels={t.fieldLabels}
          onDelete={deleteCorrection}
          translations={t.list}
        />
      )}
    </div>
  );
}
