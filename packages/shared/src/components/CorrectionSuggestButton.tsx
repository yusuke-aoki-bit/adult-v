'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { CorrectionForm, CorrectionList, type CorrectionFormTranslations, type CorrectionListTranslations } from './';
import { useCorrections } from '../hooks';
import { useFirebaseAuth } from '../contexts';
import { correctionSuggestTranslations } from '../lib/translations';

const translations = correctionSuggestTranslations as Record<
  string,
  {
    buttonLabel: string;
    form: CorrectionFormTranslations;
    list: CorrectionListTranslations;
    fieldLabels: Record<string, string>;
  }
>;

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
  const t = translations[locale] ?? translations['ja']!;
  const { user, linkGoogle } = useFirebaseAuth();
  const userId = user?.uid ?? null;

  const [showForm, setShowForm] = useState(false);
  const { corrections, isLoading, fetchCorrections, submitCorrection, deleteCorrection } = useCorrections({
    targetType,
    targetId,
    userId,
  });

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
        className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-yellow-400"
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
